import apiClient from "./client";

/** User profile shape returned by GET /api/auth/me */
export interface UserProfile {
  id: string;
  twitch_id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  broadcaster_type: string;
  bio: string;
  is_premium: boolean;
  is_admin: boolean;
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
}

/**
 * Fetch the currently authenticated user's profile.
 * Relies on the httpOnly cookie being sent automatically.
 */
export async function getMe(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/auth/me");
  return response.data;
}

/**
 * Log out the current user.
 * Clears the auth cookie on the backend.
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

/**
 * Get the URL to initiate Twitch OAuth login.
 * The backend handles redirect to Twitch.
 */
export function getTwitchAuthUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string || "/api";
  return `${baseUrl}/auth/twitch`;
}
