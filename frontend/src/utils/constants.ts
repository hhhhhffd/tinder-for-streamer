/**
 * Application-wide constants.
 */

/** League definitions with display name and color */
export const LEAGUES = {
  bronze: { name: "Бронза", color: "#CD7F32", minViewers: 0, maxViewers: 50 },
  silver: { name: "Серебро", color: "#C0C0C0", minViewers: 51, maxViewers: 250 },
  gold: { name: "Золото", color: "#FFD700", minViewers: 251, maxViewers: 1000 },
  platinum: { name: "Платина", color: "#E5E4E2", minViewers: 1001, maxViewers: Infinity },
} as const;

/** Like limits for free and premium users */
export const LIKE_LIMITS = {
  free: { sameLeague: 20, higherLeague: 1, superLikes: 0 },
  premium: { sameLeague: 40, higherLeague: 5, superLikes: 5 },
} as const;
