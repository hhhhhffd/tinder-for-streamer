import { motion, AnimatePresence } from "framer-motion";
import LeagueBadge from "./LeagueBadge";
import { LEAGUES } from "../../utils/constants";

interface LeaguePopupProps {
  /** Whether the popup is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Assigned league key (e.g. "bronze", "gold") */
  league: string;
  /** Average viewers that determined the league */
  avgViewers: number;
}

/**
 * Animated popup that shows the user their assigned league after onboarding.
 *
 * Displays the league badge, viewer count, and an explanation of the league system.
 */
export default function LeaguePopup({ isOpen, onClose, league, avgViewers }: LeaguePopupProps) {
  const leagueKey = league.toLowerCase() as keyof typeof LEAGUES;
  const leagueInfo = LEAGUES[leagueKey];
  const color = leagueInfo?.color ?? "#9146FF";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-card border bg-surface p-8 text-center"
            style={{ borderColor: `${color}40` }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Star icon with league color */}
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", delay: 0.2, damping: 10 }}
              className="mx-auto mb-4"
            >
              <svg className="mx-auto h-16 w-16" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </motion.div>

            <h2 className="mb-2 text-2xl font-bold text-white">Ваша лига</h2>

            <div className="mb-4 flex justify-center">
              <LeagueBadge league={league} size="lg" />
            </div>

            <p className="mb-1 text-sm text-gray-400">
              Среднее количество зрителей: <span className="font-semibold text-white">{avgViewers}</span>
            </p>

            {leagueInfo && (
              <p className="mb-6 text-sm text-gray-500">
                Диапазон: {leagueInfo.minViewers} – {leagueInfo.maxViewers === Infinity ? "∞" : leagueInfo.maxViewers} зрителей
              </p>
            )}

            <p className="mb-6 text-xs text-gray-500">
              Лига определяется автоматически и обновляется каждые 24 часа на основе вашей статистики Twitch.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg py-3 font-semibold text-white transition-colors"
              style={{ backgroundColor: color }}
            >
              Отлично, поехали!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
