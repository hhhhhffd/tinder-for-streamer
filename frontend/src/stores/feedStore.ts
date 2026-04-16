import { create } from "zustand";
import type { FeedFilters } from "../api/feed";

/** Feed store state and actions */
interface FeedState {
  /** Current active filters */
  filters: FeedFilters;
  /** Whether the filter panel is open */
  isFilterOpen: boolean;
  /** Update one or more filter fields */
  setFilters: (filters: Partial<FeedFilters>) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Toggle filter panel visibility */
  toggleFilterPanel: () => void;
  /** Set filter panel visibility explicitly */
  setFilterOpen: (open: boolean) => void;
}

const DEFAULT_FILTERS: FeedFilters = {};

/**
 * Zustand store for feed UI state.
 *
 * Manages filter selections and panel visibility.
 * The actual feed data is managed by TanStack Query via useFeed hook.
 */
export const useFeedStore = create<FeedState>((set) => ({
  filters: { ...DEFAULT_FILTERS },
  isFilterOpen: false,

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  toggleFilterPanel: () =>
    set((state) => ({ isFilterOpen: !state.isFilterOpen })),

  setFilterOpen: (open) => set({ isFilterOpen: open }),
}));
