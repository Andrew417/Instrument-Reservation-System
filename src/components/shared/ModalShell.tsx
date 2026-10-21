import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  zIndex?: string;
  maxHeight?: string;
  className?: string;
  children: React.ReactNode;
  titleClassName?: string;
  headerExtra?: React.ReactNode;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  subtitle,
  size = "md",
  zIndex = "z-[130]",
  maxHeight,
  className = "",
  children,
  titleClassName,
  headerExtra,
  showCloseButton = true,
  closeButtonAriaLabel = "Close modal",
}) => {
  // ESC key listener for modal accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || "max-w-md";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white border border-stone-200 rounded-2xl w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 ${sizeClass} ${maxHeight || ""} ${className}`}
      >
        {(title || icon || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              {icon && <div className="shrink-0">{icon}</div>}
              <div className="min-w-0">
                {title && (
                  <h3 className={`font-bold text-stone-900 truncate ${titleClassName || "text-base"}`}>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerExtra}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeButtonAriaLabel}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
