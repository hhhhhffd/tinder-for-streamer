import { useState } from "react";
import { useMatches } from "../hooks/useMatches";
import { useUnreadCounts } from "../hooks/useChat";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import ChatWindow from "../components/chat/ChatWindow";
import LeagueBadge from "../components/common/LeagueBadge";
import type { MatchItem } from "../api/matches";

/**
 * Chat page — main messaging hub.
 *
 * Two-pane layout:
 * - Left pane: scrollable list of matches with last message preview + unread badge
 * - Right pane (or full-screen on mobile): ChatWindow for the selected match
 *
 * On mobile, tapping a match replaces the list with the full-screen chat.
 * On desktop, both panes are visible side-by-side.
 */
export default function Chat() {
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const { data: matchesData, isLoading } = useMatches();
  const { data: unreadData } = useUnreadCounts();
  const currentUser = useAuthStore((s) => s.user);
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  const matches = matchesData?.matches ?? [];

  const handleSelectMatch = (match: MatchItem) => {
    setSelectedMatch(match);
  };

  const handleCloseChat = () => {
    setSelectedMatch(null);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
          <p className="text-gray-400">Загружаем чаты...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-background">
      {/* Match list pane — hidden on mobile when chat is open */}
      <div
        className={`flex h-full w-full flex-col border-r border-border md:w-80 lg:w-96 ${
          selectedMatch ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <header className="shrink-0 border-b border-border px-4 py-3">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Чаты</span>
            {unreadData && unreadData.total_unread > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-twitch-purple px-1.5 text-xs font-semibold text-white">
                {unreadData.total_unread}
              </span>
            )}
          </h1>
        </header>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-2 text-5xl">💬</p>
              <p className="text-lg font-semibold text-gray-300">Нет чатов</p>
              <p className="mt-1 text-sm text-gray-500">
                Найдите мэтч в ленте, чтобы начать общение!
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((match) => {
                const partner = match.partner;
                const unread = unreadCounts[match.id] ?? 0;
                const isSelected = selectedMatch?.id === match.id;

                return (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectMatch(match)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                        isSelected ? "bg-surface" : ""
                      }`}
                    >
                      {/* Avatar with online indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={partner.profile_image_url}
                          alt={partner.display_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      </div>

                      {/* Name + league */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {partner.display_name}
                          </span>
                          {partner.stats && (
                            <LeagueBadge league={partner.stats.league} size="sm" />
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {partner.bio || "Нажмите, чтобы начать общение"}
                        </p>
                      </div>

                      {/* Unread badge */}
                      {unread > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-twitch-purple px-1.5 text-xs font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat pane — full screen on mobile, right side on desktop */}
      <div
        className={`h-full flex-1 ${
          selectedMatch ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedMatch && currentUser ? (
          <div className="h-full w-full">
            <ChatWindow
              matchId={selectedMatch.id}
              currentUserId={currentUser.id}
              partnerId={selectedMatch.partner.id}
              partnerName={selectedMatch.partner.display_name}
              partnerAvatarUrl={selectedMatch.partner.profile_image_url}
              onClose={handleCloseChat}
            />
          </div>
        ) : (
          /* Empty state for desktop when no chat selected */
          <div className="hidden h-full w-full items-center justify-center md:flex">
            <div className="text-center">
              <p className="mb-2 text-5xl">💬</p>
              <p className="text-lg font-semibold text-gray-300">
                Выберите чат
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Нажмите на мэтч слева, чтобы начать общение
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
