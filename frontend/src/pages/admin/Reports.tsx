import { useState } from "react";
import {
  useAdminReports,
  useUpdateAdminReport,
  useUpdateAdminUser,
} from "../../hooks/useAdmin";
import LeagueBadge from "../../components/common/LeagueBadge";

/**
 * Admin reports page — list of pending reports with action buttons.
 *
 * Each report shows reporter, reported user, reason, and date.
 * Actions: ban reported user, dismiss report, mark as reviewed.
 */
export default function Reports() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useAdminReports({
    status: statusFilter || undefined,
    page,
    limit,
  });
  const updateReport = useUpdateAdminReport();
  const updateUser = useUpdateAdminUser();

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  /** Ban the reported user and resolve the report */
  const handleBanAndResolve = (reportId: string, reportedUserId: string) => {
    updateUser.mutate(
      { userId: reportedUserId, data: { is_banned: true } },
      {
        onSuccess: () => {
          updateReport.mutate({
            reportId,
            data: {
              status: "resolved",
              admin_notes: "Пользователь забанен по жалобе",
            },
          });
        },
      },
    );
  };

  /** Dismiss report without action */
  const handleDismiss = (reportId: string) => {
    updateReport.mutate({
      reportId,
      data: {
        status: "resolved",
        admin_notes: "Жалоба отклонена",
      },
    });
  };

  /** Mark as reviewed (need more info) */
  const handleReview = (reportId: string) => {
    updateReport.mutate({
      reportId,
      data: { status: "reviewed" },
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Жалобы</h2>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-twitch-purple"
        >
          <option value="pending">Ожидают</option>
          <option value="reviewed">На рассмотрении</option>
          <option value="resolved">Решённые</option>
          <option value="">Все</option>
        </select>
      </div>

      {/* Report list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
          </div>
        ) : !data?.reports.length ? (
          <div className="py-12 text-center">
            <p className="text-lg text-gray-400">Нет жалоб</p>
          </div>
        ) : (
          data.reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              {/* Header: reporter → reported */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {/* Reporter */}
                <div className="flex items-center gap-2">
                  <img
                    src={report.reporter.profile_image_url}
                    alt={report.reporter.display_name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {report.reporter.display_name}
                    </p>
                    <p className="text-xs text-gray-500">Жалуется</p>
                  </div>
                </div>

                <span className="text-gray-500">→</span>

                {/* Reported */}
                <div className="flex items-center gap-2">
                  <img
                    src={report.reported.profile_image_url}
                    alt={report.reported.display_name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {report.reported.display_name}
                    </p>
                    {report.reported.stats && (
                      <LeagueBadge
                        league={report.reported.stats.league}
                        size="sm"
                      />
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="ml-auto">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      report.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : report.status === "reviewed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {report.status === "pending"
                      ? "Ожидает"
                      : report.status === "reviewed"
                        ? "На рассмотрении"
                        : "Решена"}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-3 rounded-lg bg-background p-3">
                <p className="text-sm text-gray-300">{report.reason}</p>
              </div>

              {/* Admin notes */}
              {report.admin_notes && (
                <div className="mb-3 rounded-lg border border-border bg-background/50 p-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    Заметки админа:
                  </p>
                  <p className="text-sm text-gray-300">{report.admin_notes}</p>
                </div>
              )}

              {/* Date + Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  {formatDate(report.created_at)}
                </span>

                {report.status !== "resolved" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview(report.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-blue-500 hover:text-blue-400"
                    >
                      На рассмотрение
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(report.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-green-500 hover:text-green-400"
                    >
                      Отклонить
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleBanAndResolve(report.id, report.reported.id)
                      }
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    >
                      Забанить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}
