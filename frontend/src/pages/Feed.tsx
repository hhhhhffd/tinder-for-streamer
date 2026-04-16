import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFeed } from "../hooks/useFeed";
import { useFeedStore } from "../stores/feedStore";
import { useAuth } from "../hooks/useAuth";
import { useDailyLimits } from "../hooks/useMatches";
import { likeUser, dislikeUser } from "../api/matches";
import type { UserProfile } from "../api/auth";
import SwipeDeck from "../components/feed/SwipeDeck";
import FilterPanel from "../components/feed/FilterPanel";
import {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  subscribeToPush,
} from "../utils/pushNotifications";

/**
 * Main feed page — where users swipe through streamer cards.
 *
 * Layout:
 * - Mobile: full-screen cards with bottom action buttons
 * - Desktop: centered max-width container with filter panel at top
 *
 * Manages the feed data via infinite query and handles like/dislike/super-like
 * API calls when cards are swiped.
 */
export default function Feed() {
  const { user } = useAuth();
  const { filters } = useFeedStore();
  const queryClient = useQueryClient();
  const { data: limits } = useDailyLimits();
  const [matchNotification, setMatchNotification] = useState<UserProfile | null>(null);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  /* Request push notification permission once after login */
  useEffect(() => {
    if (!user || !isPushSupported()) return;
    if (getPermissionStatus() === "default") {
      /* Small delay so it doesn't feel aggressive on first load */
      const timer = setTimeout(() => setShowPushPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
    /* If already granted, ensure subscription is active */
    if (getPermissionStatus() === "granted") {
      subscribeToPush();
    }
  }, [user]);

  const handlePushAccept = useCallback(async () => {
    const result = await requestPermission();
    if (result === "granted") {
      await subscribeToPush();
    }
    setShowPushPrompt(false);
  }, []);

  const handlePushDismiss = useCallback(() => {
    setShowPushPrompt(false);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useFeed(filters);

  // Flatten all pages into a single profile list
  const allProfiles = useMemo(
    () => data?.pages.flatMap((page) => page.profiles) ?? [],
    [data],
  );

  const handleLike = useCallback(
    async (profile: UserProfile) => {
      try {
        const result = await likeUser(profile.id, "like");
        queryClient.invalidateQueries({ queryKey: ["dailyLimits"] });
        if (result.is_match) {
          setMatchNotification(profile);
          setTimeout(() => setMatchNotification(null), 3000);
        }
      } catch (error) {
        console.error("Like failed:", error);
      }
    },
    [queryClient],
  );

  const handleDislike = useCallback(async (profile: UserProfile) => {
    try {
      await dislikeUser(profile.id);
    } catch (error) {
      console.error("Dislike failed:", error);
    }
  }, []);

  const handleSuperLike = useCallback(
    async (profile: UserProfile) => {
      try {
        const result = await likeUser(profile.id, "super_like");
        queryClient.invalidateQueries({ queryKey: ["dailyLimits"] });
        if (result.is_match) {
          setMatchNotification(profile);
          setTimeout(() => setMatchNotification(null), 3000);
        }
      } catch (error) {
        console.error("Super-like failed:", error);
      }
    },
    [queryClient],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
          <p className="text-gray-400">Загружаем ленту...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="mb-2 text-xl text-red-500">Ошибка загрузки ленты</p>
          <p className="text-gray-400">Попробуйте обновить страницу</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header with filter panel */}
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-app items-center justify-between">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Stream</span>Match
          </h1>
          <div className="flex items-center gap-3">
            {limits && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span title="Лайки (своя лига)">
                  ❤️ {limits.same_league_max - limits.same_league_used}/{limits.same_league_max}
                </span>
                {limits.super_like_max > 0 && (
                  <span title="Супер-лайки">
                    ⭐ {limits.super_like_max - limits.super_like_used}/{limits.super_like_max}
                  </span>
                )}
              </div>
            )}
            <FilterPanel />
          </div>
        </div>
      </header>

      {/* Swipe area */}
      <div className="mx-auto flex w-full max-w-app flex-1 flex-col px-4 py-4">
        <SwipeDeck
          profiles={allProfiles}
          isPremium={user?.is_premium ?? false}
          onLike={handleLike}
          onDislike={handleDislike}
          onSuperLike={handleSuperLike}
          onLoadMore={handleLoadMore}
          isLoadingMore={isFetchingNextPage}
          hasMore={hasNextPage ?? false}
        />
      </div>

      {/* Match notification overlay */}
      {matchNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="animate-bounce text-center">
            <p className="mb-4 text-5xl">🎉</p>
            <h2 className="mb-2 text-3xl font-bold text-twitch-purple">
              Совпадение!
            </h2>
            <p className="text-lg text-white">
              Вы и{" "}
              <span className="font-semibold">
                {matchNotification.display_name}
              </span>{" "}
              понравились друг другу
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Теперь вы можете начать чат!
            </p>
          </div>
        </div>
      )}

      {/* Push notification permission prompt */}
      {showPushPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-lg">
          <p className="mb-1 text-sm font-semibold text-white">
            Включить уведомления?
          </p>
          <p className="mb-3 text-xs text-gray-400">
            Узнавайте о новых мэтчах и сообщениях мгновенно
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePushDismiss}
              className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
            >
              Не сейчас
            </button>
            <button
              type="button"
              onClick={handlePushAccept}
              className="flex-1 rounded-lg bg-twitch-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-twitch-purple-hover"
            >
              Включить
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
