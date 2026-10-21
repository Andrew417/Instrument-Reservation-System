import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw } from "lucide-react";
import { getStatusColor } from "../../lib/status-colors";

export interface TrustedStatusAuditLogItem {
  id: string;
  created_at: string;
  action: string;
  target_user_name: string;
  granted_by_admin_name: string;
  reason?: string;
}

type SortKey =
  | "created_at"
  | "action"
  | "target_user_name"
  | "granted_by_admin_name"
  | "reason";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

interface TrustedStatusTabProps {
  trustedAuditLogs: TrustedStatusAuditLogItem[];
  loadingAuditLogs: boolean;
}

export const TrustedStatusTab: React.FC<TrustedStatusTabProps> = ({
  trustedAuditLogs,
  loadingAuditLogs,
}) => {
  const { t } = useTranslation();
  const [sort, setSort] = React.useState<SortState>({
    key: "created_at",
    direction: "desc",
  });

  const sortedAuditLogs = React.useMemo(() => {
    return [...trustedAuditLogs].sort((left, right) => {
      const leftValue =
        sort.key === "created_at"
          ? new Date(left.created_at).getTime()
          : (left[sort.key] || "").toLocaleLowerCase();
      const rightValue =
        sort.key === "created_at"
          ? new Date(right.created_at).getTime()
          : (right[sort.key] || "").toLocaleLowerCase();

      if (leftValue < rightValue) return sort.direction === "asc" ? -1 : 1;
      if (leftValue > rightValue) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [sort, trustedAuditLogs]);

  const handleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sort.direction === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  const sortableHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 text-left hover:text-stone-900"
      aria-label={t("admin.trustedStatus.sortBy", { column: label })}
    >
      {label}
      {sortIcon(key)}
    </button>
  );

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="border-b border-stone-100 pb-3">
        <h2 className="font-bold text-stone-900 text-sm">
          {t("admin.trustedStatus.title")}
        </h2>
        <p className="text-xs text-stone-500">
          {t("admin.trustedStatus.subtitle")}
        </p>
      </div>

      {loadingAuditLogs ? (
        <div className="py-12 flex flex-col items-center gap-2 text-stone-500">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
          <div className="text-xs">{t("admin.trustedStatus.loading")}</div>
        </div>
      ) : trustedAuditLogs.length === 0 ? (
        <div className="py-12 text-center text-stone-400 text-xs">
          {t("admin.trustedStatus.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                <th className="py-2.5 px-3">
                  {sortableHeader(
                    "created_at",
                    t("admin.trustedStatus.colDateTime"),
                  )}
                </th>
                <th className="py-2.5 px-3">
                  {sortableHeader("action", t("admin.trustedStatus.colAction"))}
                </th>
                <th className="py-2.5 px-3">
                  {sortableHeader(
                    "target_user_name",
                    t("admin.trustedStatus.colTargetMember"),
                  )}
                </th>
                <th className="py-2.5 px-3">
                  {sortableHeader(
                    "granted_by_admin_name",
                    t("admin.trustedStatus.colAuthorizedBy"),
                  )}
                </th>
                <th className="py-2.5 px-3">
                  {sortableHeader("reason", t("admin.trustedStatus.colNote"))}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sortedAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50/60 transition">
                  <td className="py-3 px-3 text-stone-600 font-mono text-[11px]">
                    {new Date(log.created_at).toLocaleString([], {
                      hour12: true,
                    })}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(
                        log.action === "granted" ? "approved" : "rejected",
                      )}`}
                    >
                      {log.action === "granted"
                        ? t("admin.trustedStatus.granted")
                        : t("admin.trustedStatus.revoked")}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-stone-900">
                    {log.target_user_name}
                  </td>
                  <td className="py-3 px-3 text-stone-700">
                    {log.granted_by_admin_name}
                  </td>
                  <td className="py-3 px-3 text-stone-500">
                    {log.reason ||
                      t(
                        log.action === "granted"
                          ? "admin.trustedStatus.grantedReason"
                          : "admin.trustedStatus.revokedReason",
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
