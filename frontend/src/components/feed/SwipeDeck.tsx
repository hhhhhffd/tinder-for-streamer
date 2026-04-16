import { useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { UserProfile } from "../../api/auth";
import SwipeCard from "./SwipeCard";

/** Number of cards to show stacked behind the top card */
const VISIBLE_STACK = 3;

/** Preload next batch when this many cards remain */
const PRELOAD_THRESHOLD = 5;

interface SwipeDeckProps {
  /** All loaded profiles from infinite query pages */
  profiles: UserProfile[];
  /** Whether the user has premium (enables super-like) */
  isPremium: boolean;
  /** Called when user likes a profile */
  onLike: (profile: UserProfile) => void;
  /** Called when user dislikes a profile */
  onDislike: (profile: UserProfile) => void;
  /** Called when user super-likes a profile */
  onSuperLike: (profile: UserProfile) => void;
  /** Called when more profiles should be loaded */
  onLoadMore: () => void;
  /** Whether more profiles are being loaded */
  isLoadingMore: boolean;
  /** Whether there are more profiles to load */
  hasMore: boolean;
}

/**
 * Swipe deck component — manages a stack of SwipeCards.
 *
 * Shows up to 3 cards stacked (only the top one is interactive).
 * When a card is swiped away, the next card becomes interactive.
 * Preloads the next batch when 5 cards remain in the deck.
 * Provides button controls for non-touch devices.
 */
export default function SwipeDeck({
  profiles,
  isPremium,
  onLike,
  onDislike,
  onSuperLike,
  onLoadMore,
  isLoadingMore,
  hasMore,
}: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // The profiles remaining to show
  const remainingProfiles = useMemo(
    () => profiles.slice(currentIndex),
    [profiles, currentIndex],
  );

  // Visible stack (top 3)
  const visibleProfiles = useMemo(
    () => remainingProfiles.slice(0, VISIBLE_STACK),
    [remainingProfiles],
  );

  const currentProfile = visibleProfiles[0];

  // Check if we need to preload more
  const checkPreload = useCallback(() => {
    if (remainingProfiles.length <= PRELOAD_THRESHOLD && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [remainingProfiles.length, hasMore, isLoadingMore, onLoadMore]);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    checkPreload();
  }, [checkPreload]);

  const handleLike = useCallback(() => {
    if (!currentProfile) return;
    onLike(currentProfile);
    advance();
  }, [currentProfile, onLike, advance]);

  const handleDislike = useCallback(() => {
    if (!currentProfile) return;
    onDislike(currentProfile);
    advance();
  }, [currentProfile, onDislike, advance]);

  const handleSuperLike = useCallback(() => {
    if (!currentProfile || !isPremium) return;
    onSuperLike(currentProfile);
    advance();
  }, [currentProfile, isPremium, onSuperLike, advance]);

  // Empty state
  if (!currentProfile) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-2 text-6xl">🎮</p>
          <h2 className="mb-2 text-xl font-bold text-white">
            Пока всё!
          </h2>
          <p className="text-gray-400">
            Новые стримеры появятся совсем скоро. Попробуйте изменить фильтры.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Card stack area */}
      <div className="relative mx-auto w-full max-w-sm flex-1" style={{ minHeight: 480 }}>
        <AnimatePresence mode="popLayout">
          {visibleProfiles.map((profile, index) => (
            <SwipeCard
              key={profile.id}
              profile={profile}
              isTop={index === 0}
              stackIndex={index}
              onLike={handleLike}
              onDislike={handleDislike}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-6">
        {/* Dislike button */}
        <button
          type="button"
          onClick={handleDislike}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 bg-surface text-red-500 transition-all hover:border-red-500 hover:bg-red-500/10 active:scale-95"
          aria-label="Пропустить"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Super-like button */}
        <button
          type="button"
          onClick={handleSuperLike}
          disabled={!isPremium}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
            isPremium
              ? "border-blue-500/30 bg-surface text-blue-500 hover:border-blue-500 hover:bg-blue-500/10"
              : "cursor-not-allowed border-gray-600/30 bg-surface text-gray-600"
          }`}
          aria-label="Супер-лайк"
          title={isPremium ? "Супер-лайк" : "Супер-лайк доступен только для Premium"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </button>

        {/* Like button */}
        <button
          type="button"
          onClick={handleLike}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/30 bg-surface text-green-500 transition-all hover:border-green-500 hover:bg-green-500/10 active:scale-95"
          aria-label="Нравится"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="pb-4 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-twitch-purple border-t-transparent" />
        </div>
      )}
    </div>
  );
}
