import { useState } from "react";
import { useAdminUsers, useUpdateAdminUser, useDeleteAdminUser } from "../../hooks/useAdmin";
import LeagueBadge from "../../components/common/LeagueBadge";

/**
 * Admin users page — paginated table with search, filters, and row actions.
 *
 * Supports search by name/login, filter by league, premium status, and ban status.
 * Row actions: toggle premium, ban/unban, toggle admin.
 */
export default function Users() {
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState("");
  const [premiumFilter, setPremiumFilter] = useState<string>("");
  const [bannedFilter, setBannedFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = {
    search: search || undefined,
    league: league || undefined,
    is_premium: premiumFilter === "" ? undefined : premiumFilter === "true",
    is_banned: bannedFilter === "" ? undefined : bannedFilter === "true",
    page,
    limit,
  };

  const { data, isLoading } = useAdminUsers(params);
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Пользователи</h2>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-twitch-purple"
        />
        <select
          value={league}
          onChange={(e) => {
            setLeague(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-twitch-purple"
        >
          <option value="">Все лиги</option>
          <option value="bronze">Бронза</option>
          <option value="silver">Серебро</option>
          <option value="gold">Золото</option>
          <option value="platinum">Платина</option>
        </select>
        <select
          value={premiumFilter}
          onChange={(e) => {
            setPremiumFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-twitch-purple"
        >
          <option value="">Premium: Все</option>
          <option value="true">Premium</option>
          <option value="false">Free</option>
        </select>
        <select
          value={bannedFilter}
          onChange={(e) => {
            setBannedFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-twitch-purple"
        >
          <option value="">Статус: Все</option>
          <option value="false">Активные</option>
          <option value="true">Забаненные</option>
        </select>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-4 py-3 font-medium">Лига</th>
              <th className="px-4 py-3 font-medium">Зрители</th>
              <th className="px-4 py-3 font-medium">Premium</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-twitch-purple border-t-transparent" />
                </td>
              </tr>
            ) : !data?.users.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              data.users.map((user) => (
                <tr key={user.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.profile_image_url}
                        alt={user.display_name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-white">
                          {user.display_name}
                        </p>
                        <p className="text-xs text-gray-500">@{user.login}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.stats ? (
                      <LeagueBadge league={user.stats.league} size="sm" />
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {user.stats?.avg_viewers ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_premium ? (
                      <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                        Premium
                      </span>
                    ) : (
                      <span className="text-gray-500">Free</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_banned ? (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                        Забанен
                      </span>
                    ) : (
                      <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        Активен
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateUser.mutate({
                            userId: user.id,
                            data: { is_premium: !user.is_premium },
                          })
                        }
                        className="rounded px-2 py-1 text-xs text-yellow-400 transition-colors hover:bg-yellow-500/10"
                        title={
                          user.is_premium
                            ? "Снять Premium"
                            : "Дать Premium"
                        }
                      >
                        {user.is_premium ? "- Premium" : "+ Premium"}
                      </button>
                      {user.is_banned ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateUser.mutate({
                              userId: user.id,
                              data: { is_banned: false },
                            })
                          }
                          className="rounded px-2 py-1 text-xs text-green-400 transition-colors hover:bg-green-500/10"
                        >
                          Разбанить
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => deleteUser.mutate(user.id)}
                          className="rounded px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          Забанить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}
