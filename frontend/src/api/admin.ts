import apiClient from "./client";
import type { UserProfile } from "./auth";

/** Dashboard statistics */
export interface AdminStats {
  total_users: number;
  active_today: number;
  matches_today: number;
  messages_today: number;
  reports_pending: number;
  premium_count: number;
  users_per_league: Record<string, number>;
}

/** Extended user for admin panel */
export interface AdminUser {
  id: string;
  twitch_id: string;
  login: string;
  display_name: string;
  email: string | null;
  profile_image_url: string;
  broadcaster_type: string;
  bio: string;
  is_premium: boolean;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
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

/** Paginated user list */
export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

/** Fields an admin can update */
export interface AdminUserUpdate {
  is_premium?: boolean;
  is_banned?: boolean;
  is_admin?: boolean;
}

/** Report with full user profiles */
export interface AdminReport {
  id: string;
  reporter: UserProfile;
  reported: UserProfile;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Paginated report list */
export interface AdminReportListResponse {
  reports: AdminReport[];
  total: number;
}

/** Report update body */
export interface AdminReportUpdate {
  status: "pending" | "reviewed" | "resolved";
  admin_notes?: string | null;
}

/** Match with both user profiles */
export interface AdminMatch {
  id: string;
  user1: UserProfile;
  user2: UserProfile;
  created_at: string;
  is_active: boolean;
}

/** Paginated match list */
export interface AdminMatchListResponse {
  matches: AdminMatch[];
  total: number;
}

/** Fetch admin dashboard stats */
export async function getAdminStats(): Promise<AdminStats> {
  const response = await apiClient.get<AdminStats>("/admin/stats");
  return response.data;
}

/** List users with search and filters */
export async function getAdminUsers(params: {
  search?: string;
  league?: string;
  is_premium?: boolean;
  is_banned?: boolean;
  page?: number;
  limit?: number;
}): Promise<AdminUserListResponse> {
  const response = await apiClient.get<AdminUserListResponse>("/admin/users", { params });
  return response.data;
}

/** Get single user details */
export async function getAdminUser(userId: string): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>(`/admin/users/${userId}`);
  return response.data;
}

/** Update user flags */
export async function updateAdminUser(userId: string, data: AdminUserUpdate): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${userId}`, data);
  return response.data;
}

/** Soft-delete (ban) a user */
export async function deleteAdminUser(userId: string): Promise<{ detail: string }> {
  const response = await apiClient.delete<{ detail: string }>(`/admin/users/${userId}`);
  return response.data;
}

/** List reports with status filter */
export async function getAdminReports(params: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<AdminReportListResponse> {
  const response = await apiClient.get<AdminReportListResponse>("/admin/reports", { params });
  return response.data;
}

/** Get single report details */
export async function getAdminReport(reportId: string): Promise<AdminReport> {
  const response = await apiClient.get<AdminReport>(`/admin/reports/${reportId}`);
  return response.data;
}

/** Update report status and notes */
export async function updateAdminReport(
  reportId: string,
  data: AdminReportUpdate,
): Promise<AdminReport> {
  const response = await apiClient.patch<AdminReport>(`/admin/reports/${reportId}`, data);
  return response.data;
}

/** List matches */
export async function getAdminMatches(params: {
  page?: number;
  limit?: number;
}): Promise<AdminMatchListResponse> {
  const response = await apiClient.get<AdminMatchListResponse>("/admin/matches", { params });
  return response.data;
}

/** Deactivate a match */
export async function deactivateAdminMatch(matchId: string): Promise<{ detail: string }> {
  const response = await apiClient.delete<{ detail: string }>(`/admin/matches/${matchId}`);
  return response.data;
}
