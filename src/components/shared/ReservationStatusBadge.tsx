import React from "react";
import { useTranslation } from "react-i18next";
import { getStatusColor } from "../../lib/status-colors";

export interface ReservationStatusBadgeProps {
  status: string;
  size?: "xs" | "sm" | "md";
  showDot?: boolean;
  className?: string;
  customLabel?: string;
}

const SIZE_CLASSES = {
  xs: "px-1.5 py-0.2 rounded-md text-[9px]",
  sm: "px-2 py-0.5 rounded-full text-[10px]",
  md: "px-2.5 py-1 rounded-full text-[11px]",
};

export const ReservationStatusBadge: React.FC<ReservationStatusBadgeProps> = ({
  status,
  size = "sm",
  showDot = false,
  className = "",
  customLabel,
}) => {
  const { t } = useTranslation();
  const colorClass = getStatusColor(status);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${sizeClass} ${colorClass} ${className}`}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0"
          aria-hidden="true"
        />
      )}
      <span>{customLabel || t(`status.${status}`, status)}</span>
    </span>
  );
};
