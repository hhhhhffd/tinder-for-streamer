import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

/** Navigation link definition */
interface NavItem {
  to: string;
  label: string;
  /** Heroicons mini SVG path */
  icon: string;
  /** Show only to admins */
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/feed",
    label: "Лента",
    icon: "M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.689z M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15.75a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.432z",
  },
  {
    to: "/matches",
    label: "Мэтчи",
    icon: "M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z",
  },
  {
    to: "/liked-me",
    label: "Лайки",
    icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  },
  {
    to: "/chat",
    label: "Чат",
    icon: "M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-2.634a4.75 4.75 0 01-1.087-3.48V6.383c.114-1.865 1.483-3.476 3.405-3.725zM9.75 7.5c-1.637.136-2.77 1.436-2.77 2.808v4.286c0 1.372 1.133 2.672 2.77 2.808a49.202 49.202 0 006.5 0c1.637-.136 2.77-1.436 2.77-2.808V10.31c0-1.373-1.133-2.673-2.77-2.809a49.11 49.11 0 00-6.5 0zM12 15a.75.75 0 01-.75-.75v-3a.75.75 0 011.5 0v3A.75.75 0 0112 15zm0-6a.75.75 0 100-1.5.75.75 0 000 1.5z",
  },
  {
    to: "/profile",
    label: "Профиль",
    icon: "M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z",
  },
  {
    to: "/admin",
    label: "Админ",
    icon: "M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495",
    adminOnly: true,
  },
];

/**
 * Responsive navigation bar.
 *
 * Mobile: fixed bottom bar with icons.
 * Desktop: fixed left sidebar with icons + labels.
 * Only shown for authenticated users.
 */
export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return null;
  }

  // Don't show navbar on landing, auth callback, onboarding
  const hiddenPaths = ["/", "/auth/callback", "/onboarding"];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.is_admin);

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-border bg-surface lg:flex">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2 px-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#9146FF" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span className="text-sm font-bold text-white">StreamMatch</span>
        </div>

        {/* Nav links */}
        <div className="flex flex-1 flex-col gap-1 px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-twitch-purple/10 text-twitch-purple"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* User section */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <img
              src={user.profile_image_url || "/default-avatar.svg"}
              alt={user.display_name}
              className="h-8 w-8 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.display_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-red-400"
          >
            Выйти
          </button>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm lg:hidden">
        <div className="flex items-center justify-around py-2">
          {visibleItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? "text-twitch-purple" : "text-gray-500"
                }`
              }
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
