import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deactivateAdminMatch,
  deleteAdminUser,
  getAdminMatches,
  getAdminReports,
  getAdminStats,
  getAdminUsers,
  updateAdminReport,
  updateAdminUser,
  type AdminMatchListResponse,
  type AdminReportListResponse,
  type AdminReportUpdate,
  type AdminStats,
  type AdminUserListResponse,
  type AdminUserUpdate,
} from "../api/admin";

/** Fetch admin dashboard stats */
export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    staleTime: 30_000,
  });
}

/** Paginated user list with filters */
export function useAdminUsers(params: {
  search?: string;
  league?: string;
  is_premium?: boolean;
  is_banned?: boolean;
  page?: number;
  limit?: number;
}) {
  return useQuery<AdminUserListResponse>({
    queryKey: ["admin", "users", params],
    queryFn: () => getAdminUsers(params),
  });
}

/** Update user flags mutation */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminUserUpdate }) =>
      updateAdminUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/** Ban (soft-delete) user mutation */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/** Paginated report list */
export function useAdminReports(params: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery<AdminReportListResponse>({
    queryKey: ["admin", "reports", params],
    queryFn: () => getAdminReports(params),
  });
}

/** Update report status/notes mutation */
export function useUpdateAdminReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: AdminReportUpdate }) =>
      updateAdminReport(reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/** Paginated match list */
export function useAdminMatches(params: { page?: number; limit?: number }) {
  return useQuery<AdminMatchListResponse>({
    queryKey: ["admin", "matches", params],
    queryFn: () => getAdminMatches(params),
  });
}

/** Deactivate match mutation */
export function useDeactivateAdminMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => deactivateAdminMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "matches"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}
