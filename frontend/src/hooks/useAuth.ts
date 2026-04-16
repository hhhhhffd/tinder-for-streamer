import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getMe, logout as apiLogout } from "../api/auth";
import type { UserProfile } from "../api/auth";
import { useAuthStore } from "../stores/authStore";

/** Query key for the current user profile */
const AUTH_QUERY_KEY = ["auth", "me"] as const;

/**
 * React Query hook for authentication state.
 *
 * Fetches the current user via GET /api/auth/me on mount.
 * Syncs the result into the Zustand authStore for synchronous access.
 * Provides user profile, loading state, and a logout function.
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const { setUser, clearUser } = useAuthStore();

  const { data: user, isLoading, isError } = useQuery<UserProfile>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const profile = await getMe();
      setUser(profile);
      return profile;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearUser();
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      window.location.href = "/";
    }
  }, [clearUser, queryClient]);

  return {
    /** The authenticated user, or undefined if not loaded / not authenticated */
    user,
    /** True while the initial auth check is in progress */
    isLoading,
    /** True if the user is authenticated (has a valid session) */
    isAuthenticated: !!user && !isError,
    /** Log out and redirect to landing page */
    logout: handleLogout,
  };
}
