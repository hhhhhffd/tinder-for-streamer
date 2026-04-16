import apiClient from "./client";
import type { UserProfile } from "./auth";

/** Premium feature details */
export interface PremiumFeatures {
  likes_per_day: number;
  super_likes_per_day: number;
  cross_league_up_per_day: number;
  undo_available: boolean;
  can_see_who_liked: boolean;
  feed_priority_boost: boolean;
}

/** Premium status response */
export interface PremiumStatus {
  is_premium: boolean;
  features: PremiumFeatures;
}

/** A user who liked the current user */
export interface LikedMeItem {
  like_type: string;
  is_cross_league_up: boolean;
  liked_at: string;
  user: UserProfile;
}

/** Paginated liked-me response */
export interface LikedMeResponse {
  users: LikedMeItem[];
  total: number;
}

/** Get current premium status and features */
export async function getPremiumStatus(): Promise<PremiumStatus> {
  const response = await apiClient.get<PremiumStatus>("/premium/status");
  return response.data;
}

/** Get list of users who liked current user (premium only) */
export async function getLikedMe(
  offset = 0,
  limit = 20,
): Promise<LikedMeResponse> {
  const response = await apiClient.get<LikedMeResponse>("/premium/liked-me", {
    params: { offset, limit },
  });
  return response.data;
}
