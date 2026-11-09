import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalShell } from "./shared/ModalShell";
import { Smartphone, Share, PlusSquare, Download, Loader2 } from "lucide-react";

export interface InstallAppPromptProps {
  isOpen: boolean;
  onClose: () => void;
  isInstalled: boolean;
  canPromptNatively: boolean;
  isIOSManualInstall: boolean;
  isAndroidManualInstall: boolean;
  promptInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

export const InstallAppPrompt: React.FC<InstallAppPromptProps> = ({
  isOpen,
  onClose,
  isInstalled,
  canPromptNatively,
  isIOSManualInstall,
  isAndroidManualInstall,
  promptInstall,
  onDismiss,
}) => {
  const { t, i18n } = useTranslation();
  const [isInstalling, setIsInstalling] = useState(false);
  const isRTL = i18n.language === "ar";

  // Auto-close on successful install
  useEffect(() => {
    if (isInstalled && isOpen) {
      onClose();
    }
  }, [isInstalled, isOpen, onClose]);

  // Never render if installed or neither native prompt nor iOS manual install applies
  if (
    !isOpen ||
    isInstalled ||
    (!canPromptNatively && !isIOSManualInstall && !isAndroidManualInstall)
  ) {
    return null;
  }

  const handleDismiss = () => {
    onDismiss();
    onClose();
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    const installed = await promptInstall();
    setIsInstalling(false);
    if (installed) {
      onClose();
    } else {
      // User dismissed / cancelled native prompt dialog; record cooldown & close
      handleDismiss();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleDismiss}
      size="sm"
      zIndex="z-[140]"
      showCloseButton={true}
      title={t("installPrompt.title")}
      icon={<Smartphone className="w-5 h-5 text-amber-800" />}
    >
      <div className="p-4 sm:p-5 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        {/* App identity snippet */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70">
          <img
            src="/logo.png"
            alt="App Icon"
            className="w-12 h-12 rounded-xl object-cover shadow-xs border border-amber-200 shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
              {t("app.title", { defaultValue: "حجز آلات كنيسة مارمرقس" })}
            </h4>
            <p className="text-[11px] sm:text-xs text-amber-900/80 leading-relaxed mt-0.5">
              {t("installPrompt.benefit")}
            </p>
          </div>
        </div>

        {/* Content variant: Android / Chrome / Edge native install */}
        {canPromptNatively && (
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full py-2.5 px-4 bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer touch-manipulation disabled:opacity-60"
            >
              {isInstalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{t("installPrompt.installButton")}</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 px-3 text-stone-600 hover:text-stone-900 text-xs font-semibold rounded-xl transition cursor-pointer touch-manipulation"
            >
              {t("installPrompt.notNow")}
            </button>
          </div>
        )}

        {/* Content variant: iOS Safari manual install */}
        {!canPromptNatively && isIOSManualInstall && (
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-bold text-stone-700">
              {t("installPrompt.iosTitle")}
            </p>
            <ol className="space-y-2 text-xs text-stone-700">
              <li className="flex items-start gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span className="leading-snug flex-1">
                  {t("installPrompt.iosStep1")}{" "}
                  <Share className="w-3.5 h-3.5 text-blue-600 inline-block align-middle mx-1" />
                </span>
              </li>
              <li className="flex items-start gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span className="leading-snug flex-1">
                  {t("installPrompt.iosStep2")}{" "}
                  <PlusSquare className="w-3.5 h-3.5 text-stone-800 inline-block align-middle mx-1" />
                </span>
              </li>
              <li className="flex items-start gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span className="leading-snug flex-1">
                  {t("installPrompt.iosStep3")}
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full mt-2 py-2.5 px-4 bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer touch-manipulation"
            >
              {t("installPrompt.gotIt")}
            </button>
          </div>
        )}

        {!canPromptNatively && isAndroidManualInstall && (
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-bold text-stone-700">
              {t("installPrompt.androidTitle", {
                defaultValue: "Add this app to your home screen",
              })}
            </p>
            <ol className="space-y-2 text-xs text-stone-700">
              <li className="flex items-start gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span className="leading-snug flex-1">
                  {t("installPrompt.androidStep1", {
                    defaultValue: "Open Chrome's menu using the three dots.",
                  })}
                </span>
              </li>
              <li className="flex items-start gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span className="leading-snug flex-1">
                  {t("installPrompt.androidStep2", {
                    defaultValue: "Tap Add to Home screen or Install app.",
                  })}
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full mt-2 py-2.5 px-4 bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer touch-manipulation"
            >
              {t("installPrompt.gotIt")}
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
