import { useState } from "react";
import { useMyProfile, useUpdateProfile } from "../hooks/useProfile";
import ProfileCard from "../components/profile/ProfileCard";

/**
 * Profile page — view and edit own profile.
 *
 * Shows the full profile card with stats, categories, and league badge.
 * Edit mode allows changing the bio field only — all other data
 * comes from Twitch and is synced automatically.
 */
export default function Profile() {
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");

  const handleStartEdit = () => {
    if (profile) {
      setBio(profile.bio);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    await updateProfile.mutateAsync({ bio });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Мой профиль</h1>
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-twitch-purple hover:text-twitch-purple"
            >
              Редактировать
            </button>
          )}
        </div>

        {/* Profile card (read-only view) */}
        {!isEditing && <ProfileCard profile={profile} variant="full" />}

        {/* Edit mode — only bio */}
        {isEditing && (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {/* Show avatar and name in edit mode too */}
            <div className="flex items-center gap-4 p-6">
              <img
                src={profile.profile_image_url || "/default-avatar.svg"}
                alt={profile.display_name}
                className="h-16 w-16 rounded-full object-cover"
              />
              <div>
                <h3 className="text-lg font-bold text-white">
                  {profile.display_name}
                </h3>
                <p className="text-sm text-gray-400">@{profile.login}</p>
              </div>
            </div>

            {/* Bio editor */}
            <div className="border-t border-border px-6 py-4">
              <label
                htmlFor="edit-bio"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                О себе
              </label>
              <textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Расскажите о себе и о том, какие коллабы вас интересуют..."
                className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none focus:ring-1 focus:ring-twitch-purple"
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {bio.length}/500
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="flex-1 rounded-lg bg-twitch-purple py-2.5 font-semibold text-white transition-colors hover:bg-twitch-purple-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateProfile.isPending ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-border py-2.5 font-semibold text-gray-300 transition-colors hover:border-gray-500"
              >
                Отмена
              </button>
            </div>

            {/* Info note */}
            <div className="border-t border-border px-6 py-3">
              <p className="text-xs text-gray-500">
                Остальные данные профиля обновляются автоматически из Twitch каждые 24 часа.
              </p>
            </div>
          </div>
        )}

        {/* Sync info */}
        {profile.stats?.last_synced_at && (
          <p className="mt-4 text-center text-xs text-gray-500">
            Последняя синхронизация:{" "}
            {new Date(profile.stats.last_synced_at).toLocaleString("ru-RU")}
          </p>
        )}
      </div>
    </main>
  );
}
