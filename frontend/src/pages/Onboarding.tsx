import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMyProfile, useUpdateProfile } from "../hooks/useProfile";
import { formatViewerCount } from "../utils/helpers";
import LeagueBadge from "../components/common/LeagueBadge";
import LeaguePopup from "../components/common/LeaguePopup";

/**
 * Onboarding page — "Проверьте свою анкету".
 *
 * Shown to first-time users after Twitch OAuth. Displays their
 * auto-populated profile data from Twitch and lets them write a bio
 * before joining the feed.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const [bio, setBio] = useState("");
  const [bioInitialized, setBioInitialized] = useState(false);
  const [showLeaguePopup, setShowLeaguePopup] = useState(false);

  // Initialize bio from profile once loaded
  if (profile && !bioInitialized) {
    setBio(profile.bio);
    setBioInitialized(true);
  }

  const handleSubmit = async () => {
    await updateProfile.mutateAsync({ bio });
    setShowLeaguePopup(true);
  };

  const handleLeagueClose = () => {
    setShowLeaguePopup(false);
    navigate("/feed", { replace: true });
  };

  if (isLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
      </main>
    );
  }

  const stats = profile.stats;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Проверьте свою анкету</h1>
          <p className="mt-1 text-sm text-gray-400">
            Данные загружены из Twitch. Добавьте описание о себе.
          </p>
        </div>

        {/* Profile card */}
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {/* Avatar + name */}
          <div className="flex flex-col items-center px-6 pb-4 pt-8">
            <img
              src={profile.profile_image_url || "/default-avatar.svg"}
              alt={profile.display_name}
              className="mb-4 h-24 w-24 rounded-full border-4 border-twitch-purple object-cover"
            />
            <h2 className="text-xl font-bold text-white">{profile.display_name}</h2>
            <p className="text-sm text-gray-400">@{profile.login}</p>
            {profile.broadcaster_type && (
              <span className="mt-1 rounded bg-twitch-purple/20 px-2 py-0.5 text-xs font-medium text-twitch-purple">
                {profile.broadcaster_type === "partner"
                  ? "Партнёр Twitch"
                  : profile.broadcaster_type === "affiliate"
                    ? "Компаньон Twitch"
                    : ""}
              </span>
            )}
            {stats && (
              <div className="mt-3">
                <LeagueBadge league={stats.league} size="lg" />
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 border-t border-border px-6 py-4">
              <div className="text-center">
                <p className="text-xl font-bold text-white">
                  {formatViewerCount(stats.avg_viewers)}
                </p>
                <p className="text-xs text-gray-400">Ср. зрители</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">
                  {formatViewerCount(stats.follower_count)}
                </p>
                <p className="text-xs text-gray-400">Подписчики</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">
                  {stats.stream_language.toUpperCase()}
                </p>
                <p className="text-xs text-gray-400">Язык</p>
              </div>
            </div>
          )}

          {/* Categories */}
          {profile.categories.length > 0 && (
            <div className="border-t border-border px-6 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Ваши категории
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.categories.map((cat) => (
                  <span
                    key={cat.category_id}
                    className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-sm text-gray-300"
                  >
                    {cat.box_art_url && (
                      <img
                        src={cat.box_art_url
                          .replace("{width}", "20")
                          .replace("{height}", "27")}
                        alt={cat.category_name}
                        className="h-5 w-4 rounded-sm object-cover"
                      />
                    )}
                    {cat.category_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio textarea */}
          <div className="border-t border-border px-6 py-4">
            <label
              htmlFor="bio"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              О себе
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Расскажите о себе и о том, какие коллабы вас интересуют..."
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none focus:ring-1 focus:ring-twitch-purple"
            />
            <p className="mt-1 text-right text-xs text-gray-500">
              {bio.length}/500
            </p>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={updateProfile.isPending}
          className="mt-6 w-full rounded-lg bg-twitch-purple py-3.5 text-lg font-semibold text-white transition-colors hover:bg-twitch-purple-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateProfile.isPending ? "Сохранение..." : "Создать аккаунт"}
        </button>
      </div>

      {/* League assignment popup */}
      {stats && (
        <LeaguePopup
          isOpen={showLeaguePopup}
          onClose={handleLeagueClose}
          league={stats.league}
          avgViewers={stats.avg_viewers}
        />
      )}
    </main>
  );
}
