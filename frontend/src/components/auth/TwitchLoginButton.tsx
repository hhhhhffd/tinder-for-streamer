import { getTwitchAuthUrl } from "../../api/auth";

/**
 * Twitch OAuth login button.
 *
 * Renders a purple button with the Twitch logo and Russian text
 * "Войти через Twitch". Clicking navigates to the backend OAuth
 * endpoint which redirects to Twitch for authorization.
 */
export default function TwitchLoginButton() {
  const handleLogin = () => {
    window.location.href = getTwitchAuthUrl();
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="inline-flex items-center gap-3 rounded-xl bg-twitch-purple px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-twitch-purple/25 transition-all hover:bg-twitch-purple-hover hover:shadow-twitch-purple/40 focus:outline-none focus:ring-2 focus:ring-twitch-purple focus:ring-offset-2 focus:ring-offset-background"
    >
      {/* Twitch Glitch logo (inline SVG) */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
      </svg>
      Войти через Twitch
    </button>
  );
}
