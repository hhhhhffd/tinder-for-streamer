import { useAdminStats } from "../../hooks/useAdmin";
import { formatViewerCount } from "../../utils/helpers";

/** League color map for the distribution chart */
const LEAGUE_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

/** Russian league names */
const LEAGUE_NAMES: Record<string, string> = {
  bronze: "Бронза",
  silver: "Серебро",
  gold: "Золото",
  platinum: "Платина",
};

/**
 * Admin dashboard page with stats cards and league distribution.
 *
 * Shows key metrics: total users, active today, matches today,
 * messages today, pending reports, premium count.
 * Includes a visual league distribution bar chart.
 */
export default function Dashboard() {
  const { data: stats, isLoading, isError } = useAdminStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="py-16 text-center text-red-500">
        Ошибка загрузки статистики
      </div>
    );
  }

  const statCards = [
    { label: "Всего пользователей", value: stats.total_users, icon: "👥" },
    { label: "Активны сегодня", value: stats.active_today, icon: "🟢" },
    { label: "Мэтчи сегодня", value: stats.matches_today, icon: "💕" },
    { label: "Сообщений сегодня", value: stats.messages_today, icon: "💬" },
    { label: "Жалобы (ожидают)", value: stats.reports_pending, icon: "🚩" },
    { label: "Premium", value: stats.premium_count, icon: "⭐" },
  ];

  const totalLeagueUsers = Object.values(stats.users_per_league).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Панель управления</h2>

      {/* Stats cards grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="mb-2 text-2xl">{card.icon}</div>
            <p className="text-2xl font-bold text-white">
              {formatViewerCount(card.value)}
            </p>
            <p className="mt-1 text-xs text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* League distribution */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Распределение по лигам
        </h3>

        {totalLeagueUsers === 0 ? (
          <p className="text-sm text-gray-400">Нет данных</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(stats.users_per_league)
              .sort(
                (a, b) =>
                  ["bronze", "silver", "gold", "platinum"].indexOf(a[0]) -
                  ["bronze", "silver", "gold", "platinum"].indexOf(b[0]),
              )
              .map(([league, count]) => {
                const percent =
                  totalLeagueUsers > 0
                    ? Math.round((count / totalLeagueUsers) * 100)
                    : 0;
                return (
                  <div key={league} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span
                        className="font-medium"
                        style={{ color: LEAGUE_COLORS[league] ?? "#ccc" }}
                      >
                        {LEAGUE_NAMES[league] ?? league}
                      </span>
                      <span className="text-gray-400">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            LEAGUE_COLORS[league] ?? "#ccc",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
