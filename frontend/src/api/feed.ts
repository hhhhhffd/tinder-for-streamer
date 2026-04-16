import apiClient from "./client";
import type { UserProfile } from "./auth";

/** Filters for the swipe feed */
export interface FeedFilters {
  categories?: string[];
  min_viewers?: number;
  max_viewers?: number;
  min_followers?: number;
  max_followers?: number;
  language?: string;
}

/** Feed response from the API */
export interface FeedResponse {
  profiles: UserProfile[];
  total: number;
  has_more: boolean;
}

/** Single category for filter dropdowns */
export interface CategoryItem {
  category_id: string;
  category_name: string;
}

/** Categories list response */
export interface CategoriesResponse {
  categories: CategoryItem[];
}

/**
 * Fetch the swipe feed with optional filters and pagination.
 */
export async function getFeed(
  filters: FeedFilters,
  offset: number = 0,
  limit: number = 20,
): Promise<FeedResponse> {
  const params: Record<string, string> = {
    offset: String(offset),
    limit: String(limit),
  };

  if (filters.categories && filters.categories.length > 0) {
    params.categories = filters.categories.join(",");
  }
  if (filters.min_viewers !== undefined) {
    params.min_viewers = String(filters.min_viewers);
  }
  if (filters.max_viewers !== undefined) {
    params.max_viewers = String(filters.max_viewers);
  }
  if (filters.min_followers !== undefined) {
    params.min_followers = String(filters.min_followers);
  }
  if (filters.max_followers !== undefined) {
    params.max_followers = String(filters.max_followers);
  }
  if (filters.language) {
    params.language = filters.language;
  }

  const response = await apiClient.get<FeedResponse>("/feed", { params });
  return response.data;
}

/**
 * Fetch all available categories for the filter panel.
 */
export async function getCategories(): Promise<CategoriesResponse> {
  const response = await apiClient.get<CategoriesResponse>("/feed/categories");
  return response.data;
}
