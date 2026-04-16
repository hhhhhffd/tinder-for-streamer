import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../api/chat";
import { useChatStore } from "../../stores/chatStore";
import { useChatConnection, useChatHistory, useMarkAsRead } from "../../hooks/useChat";
import MessageBubble from "./MessageBubble";
import ReportModal from "../common/ReportModal";
import BlockConfirm from "../common/BlockConfirm";

interface ChatWindowProps {
  /** Match ID of the conversation to display */
  matchId: string;
  /** Current user's ID for distinguishing own/partner messages */
  currentUserId: string;
  /** Partner's ID for report/block */
  partnerId: string;
  /** Partner's display name (shown in header) */
  partnerName: string;
  /** Partner's avatar URL */
  partnerAvatarUrl: string;
  /** Callback to close the chat window */
  onClose: () => void;
}

/**
 * Full chat conversation window.
 *
 * Features:
 * - Real-time messages via WebSocket
 * - Infinite scroll for loading older messages (scroll up)
 * - Auto-scroll to bottom on new messages
 * - Message grouping by sender
 * - Date separators between days
 * - Typing indicator
 * - Read receipts
 * - Input field with send button
 */
export default function ChatWindow({
  matchId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatarUrl,
  onClose,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* Store state */
  const storeMessages = useChatStore((s) => s.messages);
  const isPartnerTyping = useChatStore((s) => s.isPartnerTyping);
  const setMessages = useChatStore((s) => s.setMessages);

  /* Hooks */
  const { sendMessage, sendTyping, sendReadReceipt } = useChatConnection(matchId, currentUserId);
  const { data: historyData, fetchNextPage, hasNextPage, isFetchingNextPage } = useChatHistory(matchId);
  const { mutate: markAsRead } = useMarkAsRead();

  /* Load initial history into store */
  useEffect(() => {
    if (historyData?.pages) {
      /* Pages come newest-first from API. Reverse each page and flatten oldest-first */
      const allMessages: ChatMessage[] = [];
      /* Iterate pages in reverse order (oldest page first) */
      for (let i = historyData.pages.length - 1; i >= 0; i--) {
        const page = historyData.pages[i];
        if (!page) continue;
        /* Each page is newest-first, so reverse to get chronological */
        const reversed = [...page.messages].reverse();
        allMessages.push(...reversed);
      }
      setMessages(allMessages);
    }
  }, [historyData, setMessages]);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [storeMessages.length]);

  /* Mark messages as read when chat opens */
  useEffect(() => {
    if (matchId) {
      markAsRead(matchId);
      sendReadReceipt();
    }
  }, [matchId, markAsRead, sendReadReceipt]);

  /* Handle scroll up for loading older messages */
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    /* Load more when scrolled near the top */
    if (container.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = container.scrollHeight;
      fetchNextPage().then(() => {
        /* Maintain scroll position after prepending messages */
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* Send message handler */
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    sendMessage(text);
    setInputValue("");
  }, [inputValue, sendMessage]);

  /* Keyboard handler — Enter to send, Shift+Enter for newline */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /* Typing indicator — debounced */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      sendTyping();
    },
    [sendTyping],
  );

  /** Check if we should show a date separator before this message */
  const shouldShowDate = (msg: ChatMessage, prevMsg: ChatMessage | undefined): boolean => {
    if (!prevMsg) return true;
    const curr = new Date(msg.created_at).toDateString();
    const prev = new Date(prevMsg.created_at).toDateString();
    return curr !== prev;
  };

  /** Format a date for the separator */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Сегодня";
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";

    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Chat header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 transition-colors hover:text-white"
          aria-label="Назад"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img
          src={partnerAvatarUrl}
          alt={partnerName}
          className="h-9 w-9 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{partnerName}</p>
          {isPartnerTyping && (
            <p className="text-xs text-twitch-purple">печатает...</p>
          )}
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-surface hover:text-white"
            aria-label="Действия"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-surface py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setShowMenu(false); setShowReport(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-background hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                </svg>
                Пожаловаться
              </button>
              <button
                type="button"
                onClick={() => { setShowMenu(false); setShowBlock(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-background hover:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Заблокировать
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Report & Block modals */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        reportedUserId={partnerId}
        reportedUserName={partnerName}
      />
      <BlockConfirm
        isOpen={showBlock}
        onClose={() => setShowBlock(false)}
        userId={partnerId}
        userName={partnerName}
        onBlocked={onClose}
      />

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {/* Loading older messages indicator */}
        {isFetchingNextPage && (
          <div className="mb-4 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-twitch-purple border-t-transparent" />
          </div>
        )}

        {/* Message list */}
        {storeMessages.map((msg, idx) => {
          const prevMsg = idx > 0 ? storeMessages[idx - 1] : undefined;
          const isOwn = msg.sender_id === currentUserId;
          const showAvatar = !isOwn && (
            !prevMsg || prevMsg.sender_id !== msg.sender_id || shouldShowDate(msg, prevMsg)
          );

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {shouldShowDate(msg, prevMsg) && (
                <div className="my-4 flex items-center justify-center">
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-gray-400">
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
                partnerAvatarUrl={partnerAvatarUrl}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {isPartnerTyping && (
          <div className="mt-2 flex items-end gap-2">
            <img
              src={partnerAvatarUrl}
              alt={partnerName}
              className="h-7 w-7 rounded-full object-cover"
            />
            <div className="rounded-2xl rounded-bl-sm bg-surface px-4 py-2">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Написать сообщение..."
            rows={1}
            className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-twitch-purple"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-twitch-purple text-white transition-colors hover:bg-twitch-purple-hover disabled:opacity-40 disabled:hover:bg-twitch-purple"
            aria-label="Отправить"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
