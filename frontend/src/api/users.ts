import apiClient from "./client";
import type { UserProfile } from "./auth";

/** Payload for updating the user's bio */
export interface UserUpdatePayload {
  bio: string;
}

/**
 * Fetch the current user's full profile (with stats and categories).
 */
export async function getMyProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/users/me/profile");
  return response.data;
}

/**
 * Update the current user's bio.
 */
export async function updateMyProfile(
  payload: UserUpdatePayload,
): Promise<UserProfile> {
  const response = await apiClient.patch<UserProfile>(
    "/users/me/profile",
    payload,
  );
  return response.data;
}

/**
 * Fetch any user's public profile by ID.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>(
    `/users/${userId}/profile`,
  );
  return response.data;
}
