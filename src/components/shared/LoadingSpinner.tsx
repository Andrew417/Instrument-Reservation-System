import React from "react";
import { RefreshCw } from "lucide-react";

export interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  centered?: boolean;
  label?: string;
  color?: "amber" | "white" | "stone" | "purple";
  className?: string;
}

const SIZE_MAP = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-6 h-6",
};

const COLOR_MAP = {
  amber: "text-amber-700",
  white: "text-white",
  stone: "text-stone-400",
  purple: "text-purple-700",
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  centered = false,
  label,
  color = "amber",
  className = "",
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const colorClass = COLOR_MAP[color] || COLOR_MAP.amber;

  const spinner = (
    <RefreshCw
      className={`animate-spin shrink-0 ${sizeClass} ${colorClass} ${className}`}
      aria-hidden="true"
    />
  );

  if (centered || label) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 ${centered ? "py-12" : ""}`}>
        {spinner}
        {label && <span className="text-xs text-stone-500 font-medium">{label}</span>}
      </div>
    );
  }

  return spinner;
};
