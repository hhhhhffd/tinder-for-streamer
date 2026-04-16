import type { UserProfile } from "../../api/auth";
import { formatViewerCount } from "../../utils/helpers";
import LeagueBadge from "../common/LeagueBadge";

/** Props for the ProfileCard component */
interface ProfileCardProps {
  /** Full user profile with stats and categories */
  profile: UserProfile;
  /** Whether to show the full card or a compact version */
  variant?: "full" | "compact";
}

/**
 * Reusable card component displaying a streamer's profile.
 *
 * Used in:
 * - Swipe feed cards (compact variant)
 * - Profile page (full variant)
 * - Match list items (compact variant)
 *
 * Shows avatar, display name, league badge, stats (viewers, followers),
 * bio, and stream categories with box art thumbnails.
 */
export default function ProfileCard({
  profile,
  variant = "full",
}: ProfileCardProps) {
  const stats = profile.stats;
  const isCompact = variant === "compact";

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      {/* Header: avatar + name + league */}
      <div className="relative">
        {/* Avatar */}
        <div className={`flex items-center gap-4 p-4 ${isCompact ? "" : "p-6"}`}>
          <img
            src={profile.profile_image_url || "/default-avatar.svg"}
            alt={profile.display_name}
            className={`rounded-full object-cover ${isCompact ? "h-12 w-12" : "h-20 w-20"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`truncate font-bold text-white ${isCompact ? "text-lg" : "text-2xl"}`}
              >
                {profile.display_name}
              </h3>
              {profile.broadcaster_type && (
                <span className="shrink-0 rounded bg-twitch-purple/20 px-2 py-0.5 text-xs font-medium text-twitch-purple">
                  {profile.broadcaster_type === "partner"
                    ? "Партнёр"
                    : profile.broadcaster_type === "affiliate"
                      ? "Компаньон"
                      : ""}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">@{profile.login}</p>
            {stats && (
              <div className="mt-1">
                <LeagueBadge league={stats.league} size={isCompact ? "sm" : "md"} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className={`grid grid-cols-3 border-t border-border ${isCompact ? "px-4 py-3" : "px-6 py-4"}`}>
          <div className="text-center">
            <p className={`font-bold text-white ${isCompact ? "text-base" : "text-xl"}`}>
              {formatViewerCount(stats.avg_viewers)}
            </p>
            <p className="text-xs text-gray-400">Зрители</p>
          </div>
          <div className="text-center">
            <p className={`font-bold text-white ${isCompact ? "text-base" : "text-xl"}`}>
              {formatViewerCount(stats.follower_count)}
            </p>
            <p className="text-xs text-gray-400">Подписчики</p>
          </div>
          <div className="text-center">
            <p className={`font-bold text-white ${isCompact ? "text-base" : "text-xl"}`}>
              {stats.stream_language.toUpperCase()}
            </p>
            <p className="text-xs text-gray-400">Язык</p>
          </div>
        </div>
      )}

      {/* Bio */}
      {profile.bio && !isCompact && (
        <div className="border-t border-border px-6 py-4">
          <p className="text-sm leading-relaxed text-gray-300">{profile.bio}</p>
        </div>
      )}

      {/* Categories */}
      {profile.categories.length > 0 && (
        <div className={`border-t border-border ${isCompact ? "px-4 py-3" : "px-6 py-4"}`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Категории
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.categories.map((cat) => (
              <span
                key={cat.category_id}
                className="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1 text-xs text-gray-300"
              >
                {cat.box_art_url && (
                  <img
                    src={cat.box_art_url.replace("{width}", "20").replace("{height}", "27")}
                    alt={cat.category_name}
                    className="h-5 w-4 rounded-sm object-cover"
                  />
                )}
                {cat.category_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
