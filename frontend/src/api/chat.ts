import apiClient from "./client";

/** A single chat message */
export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

/** Paginated chat history response */
export interface ChatHistoryResponse {
  messages: ChatMessage[];
  total: number;
  has_more: boolean;
}

/** Unread counts response */
export interface UnreadCountsResponse {
  unread: Record<string, number>;
  total_unread: number;
}

/** WebSocket incoming message types */
export interface WsMessageEvent {
  type: "message";
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface WsTypingEvent {
  type: "typing";
  sender_id: string;
  match_id: string;
}

export interface WsReadReceiptEvent {
  type: "read_receipt";
  sender_id: string;
  match_id: string;
}

export interface WsErrorEvent {
  type: "error";
  content: string;
}

export type WsIncomingEvent = WsMessageEvent | WsTypingEvent | WsReadReceiptEvent | WsErrorEvent;

/**
 * Fetch paginated chat history for a match.
 * Messages returned newest-first. Use 'before' cursor for pagination.
 */
export async function getChatHistory(
  matchId: string,
  before?: string,
  limit = 50,
): Promise<ChatHistoryResponse> {
  const params: Record<string, string | number> = { limit };
  if (before) {
    params.before = before;
  }
  const response = await apiClient.get<ChatHistoryResponse>(
    `/chat/${matchId}/messages`,
    { params },
  );
  return response.data;
}

/**
 * Mark all unread messages in a match as read.
 */
export async function markMessagesRead(
  matchId: string,
): Promise<{ marked_read: number }> {
  const response = await apiClient.post<{ marked_read: number }>(
    `/chat/${matchId}/read`,
  );
  return response.data;
}

/**
 * Get unread message counts for all active matches.
 */
export async function getUnreadCounts(): Promise<UnreadCountsResponse> {
  const response = await apiClient.get<UnreadCountsResponse>("/chat/unread");
  return response.data;
}

/**
 * Build a WebSocket URL for a match chat.
 * Uses the current host and protocol (ws/wss) with credentials via cookie.
 */
export function buildWsUrl(matchId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws/chat/${matchId}`;
}
