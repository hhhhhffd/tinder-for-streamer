import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blockUser } from "../../api/reports";
import Modal from "./Modal";

interface BlockConfirmProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** ID of the user to block */
  userId: string;
  /** Display name of the user to block */
  userName: string;
  /** Optional callback after successful block */
  onBlocked?: () => void;
}

/**
 * Confirmation dialog for blocking a user.
 *
 * Shows a warning about what blocking means and asks for confirmation.
 * On confirm, blocks the user and invalidates relevant queries.
 */
export default function BlockConfirm({
  isOpen,
  onClose,
  userId,
  userName,
  onBlocked,
}: BlockConfirmProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      /* Invalidate all queries that might be affected by blocking */
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCounts"] });
      onClose();
      onBlocked?.();
    },
  });

  const handleConfirm = useCallback(() => {
    mutate();
  }, [mutate]);

  const errorMessage = error
    ? (error as Error & { response?: { data?: { detail?: string } } })?.response?.data?.detail
      ?? "Ошибка блокировки"
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Заблокировать пользователя">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">
          Вы уверены, что хотите заблокировать{" "}
          <span className="font-semibold text-white">{userName}</span>?
        </p>

        <div className="rounded-lg bg-background p-3 text-sm text-gray-400">
          <p className="mb-1 font-semibold text-gray-300">После блокировки:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Пользователь исчезнет из вашей ленты</li>
            <li>Вы не будете видны в его ленте</li>
            <li>Мэтч будет деактивирован</li>
            <li>Переписка станет недоступна</li>
          </ul>
        </div>

        {errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
          >
            {isPending ? "Блокировка..." : "Заблокировать"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
