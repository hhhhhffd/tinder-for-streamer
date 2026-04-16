import { create } from "zustand";
import type { ChatMessage } from "../api/chat";

/** Chat store state and actions */
interface ChatState {
  /** Currently active match ID (open chat) */
  activeMatchId: string | null;
  /** Active WebSocket connection */
  ws: WebSocket | null;
  /** Messages for the active chat, ordered oldest-first */
  messages: ChatMessage[];
  /** Whether the partner is currently typing */
  isPartnerTyping: boolean;
  /** Unread counts per match_id */
  unreadCounts: Record<string, number>;
  /** Total unread across all matches */
  totalUnread: number;

  /** Set the active chat match */
  setActiveMatch: (matchId: string | null) => void;
  /** Store the WebSocket reference */
  setWs: (ws: WebSocket | null) => void;
  /** Set messages (replacing existing) */
  setMessages: (messages: ChatMessage[]) => void;
  /** Prepend older messages (for infinite scroll) */
  prependMessages: (messages: ChatMessage[]) => void;
  /** Append a new incoming/outgoing message */
  addMessage: (message: ChatMessage) => void;
  /** Mark all messages in the active chat as read (local state) */
  markAllRead: () => void;
  /** Set typing indicator */
  setPartnerTyping: (typing: boolean) => void;
  /** Set unread counts from API */
  setUnreadCounts: (counts: Record<string, number>, total: number) => void;
  /** Decrement unread count for a specific match */
  clearUnreadForMatch: (matchId: string) => void;
  /** Disconnect and reset chat state */
  disconnect: () => void;
}

/**
 * Zustand store for chat UI state.
 *
 * Manages the active WebSocket connection, message list for the
 * open conversation, typing indicators, and unread counts.
 * Server state (history fetching) is handled by TanStack Query.
 */
export const useChatStore = create<ChatState>((set, get) => ({
  activeMatchId: null,
  ws: null,
  messages: [],
  isPartnerTyping: false,
  unreadCounts: {},
  totalUnread: 0,

  setActiveMatch: (matchId) => set({ activeMatchId: matchId }),

  setWs: (ws) => set({ ws }),

  setMessages: (messages) => set({ messages }),

  prependMessages: (older) =>
    set((state) => ({
      messages: [...older, ...state.messages],
    })),

  addMessage: (message) =>
    set((state) => {
      /* Avoid duplicates by checking if message ID already exists */
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  markAllRead: () =>
    set((state) => ({
      messages: state.messages.map((m) => ({ ...m, is_read: true })),
    })),

  setPartnerTyping: (typing) => set({ isPartnerTyping: typing }),

  setUnreadCounts: (counts, total) =>
    set({ unreadCounts: counts, totalUnread: total }),

  clearUnreadForMatch: (matchId) =>
    set((state) => {
      const removed = state.unreadCounts[matchId] ?? 0;
      const updated = { ...state.unreadCounts };
      delete updated[matchId];
      return {
        unreadCounts: updated,
        totalUnread: Math.max(0, state.totalUnread - removed),
      };
    }),

  disconnect: () => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    set({
      activeMatchId: null,
      ws: null,
      messages: [],
      isPartnerTyping: false,
    });
  },
}));
