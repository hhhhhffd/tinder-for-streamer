import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * OAuth callback landing page.
 *
 * After the backend processes the Twitch callback, it redirects here
 * (to /onboarding or /feed). This component handles the edge case
 * where the user lands on /auth/callback directly with an error.
 *
 * In the normal flow, the backend redirect goes straight to /feed
 * or /onboarding — this page is a fallback for error scenarios.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      // Twitch denied authorization or something went wrong
      console.error("OAuth error:", error, errorDescription);
      navigate("/", { replace: true });
      return;
    }

    // If we got here without an error, the backend should have already
    // redirected us. Navigate to feed as a safe fallback.
    navigate("/feed", { replace: true });
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
        <p className="text-lg text-gray-400">Авторизация...</p>
      </div>
    </main>
  );
}
