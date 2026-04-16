import { useMatches } from "../hooks/useMatches";
import MatchList from "../components/matches/MatchList";

/**
 * Matches page — shows all mutual matches for the current user.
 *
 * Displays a header with the match count and a scrollable list
 * of matched streamers sorted by most recent first.
 */
export default function Matches() {
  const { data, isLoading, isError } = useMatches();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
          <p className="text-gray-400">Загружаем мэтчи...</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="mb-2 text-xl text-red-500">Ошибка загрузки</p>
          <p className="text-gray-400">Попробуйте обновить страницу</p>
        </div>
      </main>
    );
  }

  const matches = data?.matches ?? [];
  const total = data?.total ?? 0;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-app items-center justify-between">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Stream</span>Match
          </h1>
          <span className="text-sm text-gray-400">
            {total} {total === 1 ? "мэтч" : "мэтчей"}
          </span>
        </div>
      </header>

      {/* Match list */}
      <div className="mx-auto w-full max-w-app flex-1">
        <MatchList matches={matches} />
      </div>
    </main>
  );
}
