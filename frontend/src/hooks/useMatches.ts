import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDailyLimits,
  getMatches,
  undoLastLike,
  type DailyLimits,
  type MatchListResponse,
} from "../api/matches";

/**
 * Fetch all active matches for the current user.
 * Refetches when the window regains focus.
 */
export function useMatches(offset = 0, limit = 50) {
  return useQuery<MatchListResponse>({
    queryKey: ["matches", offset, limit],
    queryFn: () => getMatches(offset, limit),
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch current daily like limits and usage.
 * Short stale time so the UI stays up-to-date after swipes.
 */
export function useDailyLimits() {
  return useQuery<DailyLimits>({
    queryKey: ["dailyLimits"],
    queryFn: getDailyLimits,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation to undo the last like (premium only).
 * Invalidates matches and limits queries on success.
 */
export function useUndoLastLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: undoLastLike,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["dailyLimits"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
