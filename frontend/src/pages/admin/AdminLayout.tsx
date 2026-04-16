import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

/**
 * Admin panel layout with sidebar navigation.
 *
 * Protects admin routes — redirects non-admin users to /feed.
 * Shows a sidebar with links to Dashboard, Users, and Reports.
 */
export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
      </main>
    );
  }

  /* Redirect non-admins */
  if (!user || !user.is_admin) {
    return <Navigate to="/feed" replace />;
  }

  const navItems = [
    { to: "/admin", label: "Дашборд", icon: "📊", end: true },
    { to: "/admin/users", label: "Пользователи", icon: "👥", end: false },
    { to: "/admin/reports", label: "Жалобы", icon: "🚩", end: false },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
        <div className="p-4">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Stream</span>Match
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">Админ-панель</p>
        </div>

        <nav className="mt-2 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-twitch-purple/10 font-semibold text-twitch-purple"
                    : "text-gray-400 hover:bg-background hover:text-white"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Back to app link */}
        <div className="mt-auto border-t border-border p-4">
          <a
            href="/feed"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Назад к приложению
          </a>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <h1 className="text-lg font-bold text-white">
            <span className="text-twitch-purple">Admin</span>
          </h1>
          <div className="flex gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-sm ${
                    isActive
                      ? "font-semibold text-twitch-purple"
                      : "text-gray-400"
                  }`
                }
              >
                {item.icon}
              </NavLink>
            ))}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
