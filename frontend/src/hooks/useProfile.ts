import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserProfile } from "../api/auth";
import {
  getMyProfile,
  getUserProfile,
  updateMyProfile,
} from "../api/users";
import type { UserUpdatePayload } from "../api/users";
import { useAuthStore } from "../stores/authStore";

/** Query key for the current user's profile */
const MY_PROFILE_KEY = ["users", "me", "profile"] as const;

/** Query key factory for public profiles */
const userProfileKey = (userId: string) =>
  ["users", userId, "profile"] as const;

/**
 * Hook to fetch the current user's full profile.
 *
 * Uses TanStack Query for caching and background refetching.
 * Prefer this over useAuth when you need stats and categories.
 */
export function useMyProfile() {
  return useQuery<UserProfile>({
    queryKey: MY_PROFILE_KEY,
    queryFn: getMyProfile,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to fetch any user's public profile by ID.
 *
 * Disabled when userId is not provided.
 */
export function useUserProfile(userId: string | undefined) {
  return useQuery<UserProfile>({
    queryKey: userProfileKey(userId ?? ""),
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Hook to update the current user's bio.
 *
 * On success, invalidates both the profile and auth queries
 * so all components reflect the updated data.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation<UserProfile, Error, UserUpdatePayload>({
    mutationFn: updateMyProfile,
    onSuccess: (updatedProfile) => {
      // Update TanStack Query cache
      queryClient.setQueryData(MY_PROFILE_KEY, updatedProfile);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      // Update Zustand store
      setUser(updatedProfile);
    },
  });
}
