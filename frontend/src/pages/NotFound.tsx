import { Link } from "react-router-dom";

/**
 * 404 page — shown when no route matches.
 *
 * Displays a minimal "not found" message with a link back to the feed.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="mb-2 text-8xl font-extrabold text-twitch-purple">404</h1>
      <p className="mb-6 text-xl text-gray-400">Страница не найдена</p>
      <Link
        to="/"
        className="rounded-lg bg-twitch-purple px-6 py-3 font-semibold text-white transition-colors hover:bg-twitch-purple-hover"
      >
        На главную
      </Link>
    </main>
  );
}
