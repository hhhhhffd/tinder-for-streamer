import { useNavigate } from "react-router-dom";
import type { MatchItem } from "../../api/matches";
import LeagueBadge from "../common/LeagueBadge";

interface MatchListProps {
  /** Sorted list of match items to display. */
  matches: MatchItem[];
}

/**
 * Scrollable list of matched streamers.
 *
 * Each row shows the partner's avatar, display name, league badge,
 * and match date. Clicking a row navigates to the chat (future feature).
 */
export default function MatchList({ matches }: MatchListProps) {
  const navigate = useNavigate();

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="mb-2 text-5xl">💜</p>
        <p className="text-lg font-semibold text-gray-300">
          Пока нет мэтчей
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Свайпайте в ленте, чтобы найти партнёра для коллаба!
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {matches.map((match) => {
        const partner = match.partner;
        const matchDate = new Date(match.created_at);
        const formattedDate = matchDate.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        });

        return (
          <li
            key={match.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate("/chat")}
            onKeyDown={(e) => { if (e.key === "Enter") navigate("/chat"); }}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
          >
            {/* Partner avatar */}
            <img
              src={partner.profile_image_url}
              alt={partner.display_name}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />

            {/* Partner info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-white">
                  {partner.display_name}
                </span>
                {partner.stats && (
                  <LeagueBadge
                    league={partner.stats.league}
                    size="sm"
                  />
                )}
              </div>
              <p className="truncate text-sm text-gray-400">
                {partner.stats
                  ? `${partner.stats.avg_viewers} зрителей · ${partner.stats.follower_count.toLocaleString("ru-RU")} подписчиков`
                  : partner.bio || "Стример"}
              </p>
            </div>

            {/* Match date */}
            <span className="shrink-0 text-xs text-gray-500">
              {formattedDate}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
