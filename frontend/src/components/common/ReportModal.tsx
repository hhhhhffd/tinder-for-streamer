import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createReport } from "../../api/reports";
import Modal from "./Modal";

/** Report reason options */
const REPORT_REASONS = [
  { value: "spam", label: "Спам" },
  { value: "offensive", label: "Оскорбительный контент" },
  { value: "fake", label: "Фейковый аккаунт" },
  { value: "other", label: "Другое" },
] as const;

interface ReportModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** ID of the user being reported */
  reportedUserId: string;
  /** Display name of the user being reported (for the header) */
  reportedUserName: string;
}

/**
 * Modal for reporting a user.
 *
 * Shows a dropdown with predefined reasons and a textarea for details.
 * Submits the report to the backend and shows success/error feedback.
 */
export default function ReportModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [success, setSuccess] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const reasonLabel = REPORT_REASONS.find((r) => r.value === selectedReason)?.label ?? selectedReason;
      const fullReason = details.trim()
        ? `${reasonLabel}: ${details.trim()}`
        : reasonLabel;
      return createReport(reportedUserId, fullReason);
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
  });

  const handleClose = useCallback(() => {
    setSelectedReason("");
    setDetails("");
    setSuccess(false);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!selectedReason) return;
    mutate();
  }, [selectedReason, mutate]);

  const errorMessage = error
    ? (error as Error & { response?: { data?: { detail?: string } } })?.response?.data?.detail
      ?? "Ошибка отправки жалобы"
    : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Пожаловаться">
      {success ? (
        <div className="py-4 text-center">
          <p className="text-lg text-green-400">Жалоба отправлена</p>
          <p className="mt-1 text-sm text-gray-400">
            Мы рассмотрим вашу жалобу на {reportedUserName}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Жалоба на <span className="font-semibold text-white">{reportedUserName}</span>
          </p>

          {/* Reason selector */}
          <div>
            <label htmlFor="report-reason" className="mb-1 block text-sm text-gray-300">
              Причина
            </label>
            <select
              id="report-reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-twitch-purple"
            >
              <option value="">Выберите причину...</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Details textarea */}
          <div>
            <label htmlFor="report-details" className="mb-1 block text-sm text-gray-300">
              Подробности (необязательно)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Опишите ситуацию..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-twitch-purple"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedReason || isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              {isPending ? "Отправка..." : "Отправить жалобу"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
