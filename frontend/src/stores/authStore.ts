import { create } from "zustand";
import type { UserProfile } from "../api/auth";

/** Auth store state and actions */
interface AuthState {
  /** Currently authenticated user profile, or null */
  user: UserProfile | null;
  /** Whether the initial auth check has completed */
  isLoaded: boolean;
  /** Set the authenticated user (called after successful /auth/me) */
  setUser: (user: UserProfile) => void;
  /** Clear the user on logout or auth failure */
  clearUser: () => void;
  /** Mark the initial auth check as complete */
  setLoaded: () => void;
}

/**
 * Zustand store for client-side auth state.
 *
 * Holds the current user profile and loaded flag. Server state
 * (fetching, refetching) is managed by TanStack Query via useAuth hook.
 * This store is only for synchronous UI reads (e.g., conditional rendering).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoaded: false,

  setUser: (user) => set({ user, isLoaded: true }),

  clearUser: () => set({ user: null, isLoaded: true }),

  setLoaded: () => set({ isLoaded: true }),
}));
