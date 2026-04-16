import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLikedMe } from "../hooks/usePremium";
import LeagueBadge from "../components/common/LeagueBadge";
import PremiumBadge from "../components/common/PremiumBadge";
import PremiumUpsellModal from "../components/common/PremiumUpsellModal";
import { formatViewerCount } from "../utils/helpers";

/**
 * "Who liked you" page — premium-only feature.
 *
 * Premium users see a grid of profile cards from users who liked them.
 * Free users see blurred placeholder cards with an upsell CTA.
 */
export default function LikedMe() {
  const { user } = useAuth();
  const isPremium = user?.is_premium ?? false;
  const [showUpsell, setShowUpsell] = useState(false);

  /* Only fetch if premium */
  const { data, isLoading } = useLikedMe(0, 50);

  /* Free user view — blurred cards + upsell */
  if (!isPremium) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b border-border px-4 py-3">
          <div className="mx-auto max-w-app">
            <h1 className="text-lg font-bold text-white">
              <span className="text-twitch-purple">Кто вас</span> лайкнул
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-app px-4 py-6">
          {/* Blurred placeholder cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="h-48 bg-gradient-to-b from-gray-700 to-gray-800 blur-lg" />
                <div className="p-3">
                  <div className="h-4 w-3/4 rounded bg-gray-700 blur-sm" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-gray-700 blur-sm" />
                </div>
              </div>
            ))}
          </div>

          {/* Upsell overlay */}
          <div className="mt-8 text-center">
            <p className="mb-2 text-4xl">👀</p>
            <h2 className="mb-2 text-xl font-bold text-white">
              Узнайте, кто вас лайкнул
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              С Premium вы сможете видеть всех, кто проявил к вам интерес
            </p>
            <button
              type="button"
              onClick={() => setShowUpsell(true)}
              className="rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Разблокировать с Premium
            </button>
          </div>
        </div>

        <PremiumUpsellModal
          isOpen={showUpsell}
          onClose={() => setShowUpsell(false)}
          feature="Кто вас лайкнул"
        />
      </main>
    );
  }

  /* Premium user view — real cards */
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto max-w-app">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Кто вас</span> лайкнул
            {data && data.total > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-twitch-purple px-1.5 text-xs font-semibold text-white">
                {data.total}
              </span>
            )}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-app px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
          </div>
        ) : !data?.users.length ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-4xl">💤</p>
            <p className="text-lg font-semibold text-gray-300">
              Пока никто вас не лайкнул
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Продолжайте свайпать — лайки скоро появятся!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {data.users.map((item) => {
              const profile = item.user;
              return (
                <div
                  key={profile.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface transition-transform hover:scale-[1.02]"
                >
                  {/* Profile image */}
                  <div className="relative">
                    <img
                      src={profile.profile_image_url || "/default-avatar.svg"}
                      alt={profile.display_name}
                      className="h-48 w-full object-cover"
                    />
                    {/* Like type badge */}
                    {item.like_type === "super_like" && (
                      <div className="absolute left-2 top-2 rounded-full bg-yellow-500/90 px-2 py-0.5 text-xs font-bold text-black">
                        Super Like
                      </div>
                    )}
                    {item.is_cross_league_up && (
                      <div className="absolute left-2 top-2 rounded-full bg-twitch-purple/90 px-2 py-0.5 text-xs font-bold text-white">
                        Из другой лиги
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {profile.display_name}
                      </h3>
                      {profile.is_premium && <PremiumBadge />}
                    </div>
                    {profile.stats && (
                      <div className="mt-1 flex items-center gap-2">
                        <LeagueBadge league={profile.stats.league} size="sm" />
                        <span className="text-xs text-gray-400">
                          {formatViewerCount(profile.stats.avg_viewers)} зрит.
                        </span>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(item.liked_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
