/**
 * Utility helper functions.
 */

/**
 * Format a number into a compact Russian-locale string.
 * Example: 1500 → "1,5 тыс."
 */
export function formatViewerCount(count: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

/**
 * Determine league name based on average viewer count.
 */
export function getLeagueByViewers(avgViewers: number): "bronze" | "silver" | "gold" | "platinum" {
  if (avgViewers <= 50) return "bronze";
  if (avgViewers <= 250) return "silver";
  if (avgViewers <= 1000) return "gold";
  return "platinum";
}
