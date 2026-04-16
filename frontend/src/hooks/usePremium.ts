import { useQuery } from "@tanstack/react-query";
import { getLikedMe, getPremiumStatus, type LikedMeResponse, type PremiumStatus } from "../api/premium";

/** Fetch current premium status and features */
export function usePremiumStatus() {
  return useQuery<PremiumStatus>({
    queryKey: ["premium", "status"],
    queryFn: getPremiumStatus,
    staleTime: 60_000,
  });
}

/** Fetch users who liked the current user (premium only) */
export function useLikedMe(offset = 0, limit = 20) {
  return useQuery<LikedMeResponse>({
    queryKey: ["premium", "liked-me", offset, limit],
    queryFn: () => getLikedMe(offset, limit),
    staleTime: 30_000,
  });
}
