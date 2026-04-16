import apiClient from "./client";

/** Response from the like endpoint */
export interface LikeResponse {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
  is_cross_league_up: boolean;
  created_at: string;
  is_match: boolean;
  match_id: string | null;
  remaining: {
    same_league: number;
    cross_up: number;
    super_like: number;
  };
}

/** Response from the dislike endpoint */
export interface DislikeResponse {
  detail: string;
}

/** Daily limits usage and maximums */
export interface DailyLimits {
  same_league_used: number;
  same_league_max: number;
  cross_up_used: number;
  cross_up_max: number;
  super_like_used: number;
  super_like_max: number;
}

/** Response from the undo endpoint */
export interface UndoResponse {
  success: boolean;
}

/** A single match with partner profile */
export interface MatchItem {
  id: string;
  partner: {
    id: string;
    twitch_id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    broadcaster_type: string;
    bio: string;
    is_premium: boolean;
    created_at: string;
    stats: {
      follower_count: number;
      avg_viewers: number;
      league: string;
      stream_language: string;
      last_synced_at: string | null;
    } | null;
    categories: Array<{
      category_id: string;
      category_name: string;
      box_art_url: string;
    }>;
  };
  created_at: string;
  is_active: boolean;
}

/** Paginated match list response */
export interface MatchListResponse {
  matches: MatchItem[];
  total: number;
}

/**
 * Send a like or super-like to another user.
 * Returns whether a mutual match was created and remaining limits.
 */
export async function likeUser(
  toUserId: string,
  type: "like" | "super_like" = "like",
): Promise<LikeResponse> {
  const response = await apiClient.post<LikeResponse>("/matches/like", {
    to_user_id: toUserId,
    type,
  });
  return response.data;
}

/**
 * Dislike (pass on) another user.
 * This records the skip so they won't appear in the feed again.
 */
export async function dislikeUser(toUserId: string): Promise<DislikeResponse> {
  const response = await apiClient.post<DislikeResponse>(
    "/matches/dislike",
    {
      to_user_id: toUserId,
    },
  );
  return response.data;
}

/**
 * Fetch all active matches for the current user.
 */
export async function getMatches(
  offset = 0,
  limit = 50,
): Promise<MatchListResponse> {
  const response = await apiClient.get<MatchListResponse>("/matches", {
    params: { offset, limit },
  });
  return response.data;
}

/**
 * Get current daily like limits and usage.
 */
export async function getDailyLimits(): Promise<DailyLimits> {
  const response = await apiClient.get<DailyLimits>("/matches/limits");
  return response.data;
}

/**
 * Undo the last like (premium only, 5-minute window).
 */
export async function undoLastLike(): Promise<UndoResponse> {
  const response = await apiClient.post<UndoResponse>("/matches/undo");
  return response.data;
}
