import { LEAGUES } from "../../utils/constants";

/** Props for the LeagueBadge component */
interface LeagueBadgeProps {
  /** League key: "bronze" | "silver" | "gold" | "platinum" */
  league: string;
  /** Optional size variant */
  size?: "sm" | "md" | "lg";
}

/** League icon SVGs — a shield/star shape for each tier */
const LEAGUE_ICONS: Record<string, string> = {
  bronze: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  silver: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  gold: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  platinum: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
};

/** Size classes for each variant */
const SIZE_CLASSES = {
  sm: { badge: "px-2 py-0.5 text-xs gap-1", icon: 12 },
  md: { badge: "px-3 py-1 text-sm gap-1.5", icon: 16 },
  lg: { badge: "px-4 py-1.5 text-base gap-2", icon: 20 },
} as const;

/**
 * Colored badge displaying the user's league tier.
 *
 * Shows a star icon and the league name in Russian.
 * Color matches the league: Bronze, Silver, Gold, or Platinum.
 */
export default function LeagueBadge({ league, size = "md" }: LeagueBadgeProps) {
  const leagueKey = league.toLowerCase() as keyof typeof LEAGUES;
  const leagueInfo = LEAGUES[leagueKey];

  if (!leagueInfo) {
    return null;
  }

  const { badge: badgeClass, icon: iconSize } = SIZE_CLASSES[size];
  const iconPath = LEAGUE_ICONS[leagueKey] ?? LEAGUE_ICONS.bronze;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${badgeClass}`}
      style={{
        backgroundColor: `${leagueInfo.color}20`,
        color: leagueInfo.color,
        border: `1px solid ${leagueInfo.color}40`,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d={iconPath} />
      </svg>
      {leagueInfo.name}
    </span>
  );
}
