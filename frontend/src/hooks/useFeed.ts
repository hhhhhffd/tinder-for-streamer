import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { FeedFilters, FeedResponse, CategoriesResponse } from "../api/feed";
import { getCategories, getFeed } from "../api/feed";

const FEED_KEY = "feed" as const;
const CATEGORIES_KEY = ["feed", "categories"] as const;
const PAGE_SIZE = 20;

/**
 * Infinite scroll hook for the swipe feed.
 *
 * Fetches pages of profiles with the given filters.
 * Automatically fetches next page when getNextPageParam returns a value.
 */
export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery<FeedResponse>({
    queryKey: [FEED_KEY, filters],
    queryFn: ({ pageParam }) => {
      const offset = pageParam as number;
      return getFeed(filters, offset, PAGE_SIZE);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch all available categories for the filter dropdown.
 */
export function useCategories() {
  return useQuery<CategoriesResponse>({
    queryKey: CATEGORIES_KEY,
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
