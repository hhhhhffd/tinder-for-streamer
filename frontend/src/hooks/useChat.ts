import { useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildWsUrl,
  getChatHistory,
  getUnreadCounts,
  markMessagesRead,
  type ChatMessage,
  type WsIncomingEvent,
} from "../api/chat";
import { useChatStore } from "../stores/chatStore";

/** Typing indicator debounce timeout (ms) */
const TYPING_DEBOUNCE = 3000;

/**
 * Hook for loading paginated chat history with infinite scroll.
 *
 * Messages are fetched newest-first from the API, then reversed
 * in the component so they display chronologically (oldest on top).
 * The 'before' cursor uses the oldest message's timestamp.
 */
export function useChatHistory(matchId: string | null) {
  return useInfiniteQuery({
    queryKey: ["chatHistory", matchId],
    queryFn: async ({ pageParam }) => {
      if (!matchId) throw new Error("No match ID");
      return getChatHistory(matchId, pageParam as string | undefined, 50);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.messages.length === 0) return undefined;
      /* The API returns newest-first, so the last item is the oldest */
      const oldest = lastPage.messages[lastPage.messages.length - 1];
      return oldest?.created_at;
    },
    enabled: !!matchId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for fetching unread message counts.
 * Polls every 30 seconds and on window focus.
 */
export function useUnreadCounts() {
  const setUnreadCounts = useChatStore((s) => s.setUnreadCounts);

  return useQuery({
    queryKey: ["unreadCounts"],
    queryFn: async () => {
      const data = await getUnreadCounts();
      setUnreadCounts(data.unread, data.total_unread);
      return data;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation to mark messages as read in a match.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const clearUnreadForMatch = useChatStore((s) => s.clearUnreadForMatch);

  return useMutation({
    mutationFn: (matchId: string) => markMessagesRead(matchId),
    onSuccess: (_data, matchId) => {
      clearUnreadForMatch(matchId);
      queryClient.invalidateQueries({ queryKey: ["unreadCounts"] });
    },
  });
}

/**
 * Core hook for managing a WebSocket chat connection.
 *
 * Connects to the WebSocket on mount when matchId is provided,
 * handles incoming messages (chat, typing, read receipts),
 * and provides sendMessage/sendTyping functions.
 *
 * Integrates with the Zustand chatStore for state management.
 */
export function useChatConnection(matchId: string | null, currentUserId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const {
    setWs,
    setActiveMatch,
    addMessage,
    setPartnerTyping,
    markAllRead,
    disconnect: storeDisconnect,
  } = useChatStore();

  /** Connect to the WebSocket for the given match */
  const connect = useCallback(() => {
    if (!matchId) return;

    const url = buildWsUrl(matchId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWs(ws);
      setActiveMatch(matchId);
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      let data: WsIncomingEvent;
      try {
        data = JSON.parse(event.data as string) as WsIncomingEvent;
      } catch {
        return;
      }

      switch (data.type) {
        case "message": {
          const msg: ChatMessage = {
            id: data.id,
            match_id: data.match_id,
            sender_id: data.sender_id,
            content: data.content,
            created_at: data.created_at,
            is_read: data.is_read,
          };
          addMessage(msg);
          /* Clear typing indicator when a message arrives */
          if (data.sender_id !== currentUserId) {
            setPartnerTyping(false);
          }
          break;
        }
        case "typing": {
          if (data.sender_id !== currentUserId) {
            setPartnerTyping(true);
            /* Auto-clear typing indicator after debounce */
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              setPartnerTyping(false);
            }, TYPING_DEBOUNCE);
          }
          break;
        }
        case "read_receipt": {
          if (data.sender_id !== currentUserId) {
            markAllRead();
          }
          break;
        }
        case "error": {
          /* Error messages are informational, no action needed */
          break;
        }
      }
    };

    ws.onclose = () => {
      setWs(null);
      /* Attempt reconnect with exponential backoff, max 30s */
      if (matchId) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      /* onclose will fire after onerror, triggering reconnect */
    };
  }, [matchId, currentUserId, setWs, setActiveMatch, addMessage, setPartnerTyping, markAllRead]);

  /** Send a chat message via WebSocket */
  const sendMessage = useCallback(
    (content: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !matchId) return;
      ws.send(JSON.stringify({ type: "message", content }));
    },
    [matchId],
  );

  /** Send a typing indicator via WebSocket */
  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing" }));
  }, []);

  /** Send a read receipt via WebSocket */
  const sendReadReceipt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "read_receipt" }));
  }, []);

  /* Connect on mount / matchId change, disconnect on unmount */
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    connect();

    return () => {
      /* Clear reconnect timer */
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      /* Close WebSocket */
      const ws = wsRef.current;
      if (ws) {
        reconnectAttemptRef.current = 999; // prevent reconnect on intentional close
        ws.close();
        wsRef.current = null;
      }
      storeDisconnect();
    };
  }, [matchId, currentUserId, connect, storeDisconnect]);

  return { sendMessage, sendTyping, sendReadReceipt };
}
