import Modal from "./Modal";

interface PremiumUpsellModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Which feature triggered the upsell */
  feature?: string;
}

/**
 * Premium upsell modal shown when a free user attempts a premium action.
 *
 * Lists all premium benefits with a CTA to upgrade.
 * For now the upgrade button is a placeholder — payment integration comes later.
 */
export default function PremiumUpsellModal({
  isOpen,
  onClose,
  feature,
}: PremiumUpsellModalProps) {
  const benefits = [
    { icon: "❤️", text: "40 лайков в день (вместо 20)" },
    { icon: "⭐", text: "5 супер-лайков в день" },
    { icon: "🏆", text: "5 лайков на высшую лигу (вместо 1)" },
    { icon: "↩️", text: "Отмена последнего лайка (5 мин)" },
    { icon: "👀", text: "Узнайте, кто вас лайкнул" },
    { icon: "🚀", text: "Приоритет в ленте других стримеров" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="StreamMatch Premium">
      <div className="space-y-4">
        {feature && (
          <p className="text-sm text-gray-400">
            Функция &laquo;{feature}&raquo; доступна только для Premium-пользователей.
          </p>
        )}

        <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-twitch-purple/10 p-4">
          <p className="mb-3 text-sm font-semibold text-white">
            Возможности Premium:
          </p>
          <ul className="space-y-2">
            {benefits.map((benefit) => (
              <li
                key={benefit.text}
                className="flex items-center gap-2 text-sm text-gray-300"
              >
                <span className="shrink-0">{benefit.icon}</span>
                {benefit.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
          >
            Не сейчас
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Подключить Premium
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">
          Оплата будет доступна в ближайшее время
        </p>
      </div>
    </Modal>
  );
}
