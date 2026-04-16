import { useState } from "react";
import { motion, type PanInfo, useMotionValue, useTransform } from "framer-motion";
import type { UserProfile } from "../../api/auth";
import { formatViewerCount } from "../../utils/helpers";
import LeagueBadge from "../common/LeagueBadge";
import PremiumBadge from "../common/PremiumBadge";
import ReportModal from "../common/ReportModal";
import BlockConfirm from "../common/BlockConfirm";

/** Threshold in pixels before a swipe is committed */
const SWIPE_THRESHOLD = 120;

/** Maximum rotation angle during drag (degrees) */
const MAX_ROTATION = 15;

interface SwipeCardProps {
  /** Profile to display */
  profile: UserProfile;
  /** Called when user swipes right (like) */
  onLike: () => void;
  /** Called when user swipes left (dislike) */
  onDislike: () => void;
  /** Whether this card is the top (interactive) card */
  isTop: boolean;
  /** Stack position index (0 = top, 1 = second, 2 = third) */
  stackIndex: number;
}

/**
 * Individual swipe card showing a streamer's profile.
 *
 * The top card is draggable with Framer Motion spring physics.
 * Dragging right shows a green "LIKE" overlay, left shows red "NOPE".
 * Tapping the bio area expands/collapses the full bio text.
 */
export default function SwipeCard({
  profile,
  onLike,
  onDislike,
  isTop,
  stackIndex,
}: SwipeCardProps) {
  const [showFullBio, setShowFullBio] = useState(false);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const stats = profile.stats;

  // Motion values for drag interaction
  const x = useMotionValue(0);

  // Rotation tied to horizontal drag distance
  const rotate = useTransform(x, [-300, 0, 300], [-MAX_ROTATION, 0, MAX_ROTATION]);

  // Overlay opacity tied to drag distance
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  // Border glow based on direction
  const borderColor = useTransform(
    x,
    [-SWIPE_THRESHOLD, -20, 0, 20, SWIPE_THRESHOLD],
    [
      "rgba(239, 68, 68, 0.6)",   // red
      "rgba(239, 68, 68, 0.1)",
      "rgba(31, 31, 35, 1)",       // default border
      "rgba(34, 197, 94, 0.1)",
      "rgba(34, 197, 94, 0.6)",   // green
    ],
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onLike();
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onDislike();
    }
  };

  // Scale and translateY for stacked cards behind the top card
  const stackScale = 1 - stackIndex * 0.05;
  const stackTranslateY = stackIndex * 8;

  return (
    <motion.div
      className="absolute left-0 top-0 h-full w-full cursor-grab active:cursor-grabbing"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: stackScale,
        y: stackTranslateY,
        zIndex: 10 - stackIndex,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
      // Entrance animation
      initial={stackIndex === 0 ? { scale: 0.95, opacity: 0 } : false}
      animate={{
        scale: stackScale,
        opacity: 1,
        y: stackTranslateY,
      }}
      // Exit animation — fly off screen
      exit={{
        x: x.get() > 0 ? 400 : -400,
        opacity: 0,
        rotate: x.get() > 0 ? 20 : -20,
        transition: { duration: 0.3 },
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className="h-full overflow-hidden rounded-card bg-surface shadow-2xl"
        style={{ borderWidth: 2, borderStyle: "solid", borderColor }}
      >
        {/* LIKE / NOPE overlays */}
        {isTop && (
          <>
            <motion.div
              className="pointer-events-none absolute left-6 top-6 z-20 rotate-[-15deg] rounded-lg border-4 border-green-500 px-4 py-2"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-3xl font-black text-green-500">LIKE</span>
            </motion.div>
            <motion.div
              className="pointer-events-none absolute right-6 top-6 z-20 rotate-[15deg] rounded-lg border-4 border-red-500 px-4 py-2"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-3xl font-black text-red-500">NOPE</span>
            </motion.div>
          </>
        )}

        {/* Card content — scrollable */}
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Profile image — large */}
          <div className="relative shrink-0">
            <img
              src={profile.profile_image_url || "/default-avatar.svg"}
              alt={profile.display_name}
              className="h-64 w-full object-cover sm:h-72"
              draggable={false}
            />

            {/* Context menu button (top-right corner) */}
            {isTop && (
              <div className="absolute right-3 top-3 z-20">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowCardMenu(!showCardMenu); }}
                  className="rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {showCardMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowCardMenu(false); setShowReport(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 hover:bg-background hover:text-white"
                    >
                      Пожаловаться
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowCardMenu(false); setShowBlock(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-background hover:text-red-300"
                    >
                      Заблокировать
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Gradient overlay at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface to-transparent" />

            {/* Name + league overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                  {profile.display_name}
                </h2>
                {profile.is_premium && <PremiumBadge size="md" />}
                {profile.broadcaster_type && (
                  <span className="rounded bg-twitch-purple/30 px-1.5 py-0.5 text-xs font-medium text-twitch-purple backdrop-blur-sm">
                    {profile.broadcaster_type === "partner"
                      ? "Партнёр"
                      : profile.broadcaster_type === "affiliate"
                        ? "Компаньон"
                        : ""}
                  </span>
                )}
              </div>
              {stats && (
                <div className="mt-1">
                  <LeagueBadge league={stats.league} size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-3 border-b border-border px-4 py-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {formatViewerCount(stats.avg_viewers)}
                </p>
                <p className="text-xs text-gray-400">Зрители</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {formatViewerCount(stats.follower_count)}
                </p>
                <p className="text-xs text-gray-400">Подписчики</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {stats.stream_language.toUpperCase()}
                </p>
                <p className="text-xs text-gray-400">Язык</p>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <button
              type="button"
              onClick={() => setShowFullBio(!showFullBio)}
              className="w-full border-b border-border px-4 py-3 text-left"
            >
              <p
                className={`text-sm leading-relaxed text-gray-300 ${
                  showFullBio ? "" : "line-clamp-2"
                }`}
              >
                {profile.bio}
              </p>
              {profile.bio.length > 100 && (
                <span className="mt-1 text-xs text-twitch-purple">
                  {showFullBio ? "Свернуть" : "Показать полностью"}
                </span>
              )}
            </button>
          )}

          {/* Categories */}
          {profile.categories.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {profile.categories.map((cat) => (
                  <span
                    key={cat.category_id}
                    className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-gray-300"
                  >
                    {cat.box_art_url && (
                      <img
                        src={cat.box_art_url
                          .replace("{width}", "16")
                          .replace("{height}", "22")}
                        alt={cat.category_name}
                        className="h-4 w-3 rounded-sm object-cover"
                        draggable={false}
                      />
                    )}
                    {cat.category_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Report & Block modals */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        reportedUserId={profile.id}
        reportedUserName={profile.display_name}
      />
      <BlockConfirm
        isOpen={showBlock}
        onClose={() => setShowBlock(false)}
        userId={profile.id}
        userName={profile.display_name}
      />
    </motion.div>
  );
}
