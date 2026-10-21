import React from "react";

export interface EmptyStateCardProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  dashed?: boolean;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
  dashed = false,
}) => {
  return (
    <div
      className={`py-12 sm:py-16 text-center text-xs text-stone-500 space-y-2 flex flex-col items-center justify-center ${
        dashed ? "border border-dashed border-stone-200 rounded-xl bg-stone-50/50" : ""
      } ${className}`}
    >
      {icon && <div className="text-stone-300 mx-auto mb-1">{icon}</div>}
      {title && <div className="font-bold text-stone-700 text-sm">{title}</div>}
      {description && (
        <div className="text-stone-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </div>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
