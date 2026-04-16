import apiClient from "./client";

/** Report creation response */
export interface ReportResponse {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: string;
  created_at: string;
}

/** Blocked user info */
export interface BlockedUser {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string;
  login: string;
  created_at: string;
}

/** Block creation response */
export interface BlockResponse {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

/**
 * Submit a report about a user.
 */
export async function createReport(
  reportedId: string,
  reason: string,
): Promise<ReportResponse> {
  const response = await apiClient.post<ReportResponse>("/reports", {
    reported_id: reportedId,
    reason,
  });
  return response.data;
}

/**
 * Block a user. Deactivates any active match.
 */
export async function blockUser(userId: string): Promise<BlockResponse> {
  const response = await apiClient.post<BlockResponse>(`/blocks/${userId}`);
  return response.data;
}

/**
 * Unblock a user.
 */
export async function unblockUser(userId: string): Promise<void> {
  await apiClient.delete(`/blocks/${userId}`);
}

/**
 * Get list of blocked users.
 */
export async function getBlockedUsers(
  offset = 0,
  limit = 50,
): Promise<{ blocks: BlockedUser[]; total: number }> {
  const response = await apiClient.get<{ blocks: BlockedUser[]; total: number }>(
    "/blocks",
    { params: { offset, limit } },
  );
  return response.data;
}
