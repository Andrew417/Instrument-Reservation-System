import { useState, useEffect, useCallback } from "react";
import { isIOS, isInAppBrowser } from "../lib/push-client";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const INSTALL_PROMPT_DISMISSED_AT_KEY = "install_prompt_dismissed_at";
export const DISMISSAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export interface InstallPromptState {
  isInstalled: boolean;
  canPromptNatively: boolean;
  isIOSManualInstall: boolean;
  isAndroidManualInstall: boolean;
  isInstallApplicable: boolean;
  promptInstall: () => Promise<boolean>;
  dismiss: () => void;
}

export function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMedia = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const isStandaloneNav =
    "standalone" in window.navigator &&
    Boolean(
      (window.navigator as unknown as { standalone?: boolean }).standalone,
    );
  return Boolean(isStandaloneMedia || isStandaloneNav);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function isDevelopmentPort(): boolean {
  return typeof window !== "undefined" && window.location.port === "3000";
}

export function isDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(INSTALL_PROMPT_DISMISSED_AT_KEY);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    return (
      !isNaN(timestamp) && Date.now() - timestamp < DISMISSAL_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

function recordInstallDismissal(): void {
  try {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_AT_KEY, Date.now().toString());
  } catch {
    console.warn("[useInstallPrompt] Unable to persist dismissal cooldown");
  }
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    checkIsStandalone(),
  );
  const [canPromptNatively, setCanPromptNatively] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() =>
    isDismissedRecently(),
  );
  const isSuppressedForDevelopment = isDevelopmentPort();

  const isIOSManualInstall =
    typeof window !== "undefined" &&
    isIOS() &&
    !isInstalled &&
    !isInAppBrowser();
  const isAndroidManualInstall =
    typeof window !== "undefined" &&
    isAndroid() &&
    !isInstalled &&
    !isInAppBrowser() &&
    !canPromptNatively;

  useEffect(() => {
    // Initial check
    const standalone = checkIsStandalone();
    setIsInstalled(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      if (isDevelopmentPort()) return;
      e.preventDefault();
      console.log("[useInstallPrompt] beforeinstallprompt captured");
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanPromptNatively(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setCanPromptNatively(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanPromptNatively(false);

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[useInstallPrompt] Error prompting install:", err);
      setDeferredPrompt(null);
      setCanPromptNatively(false);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    recordInstallDismissal();
    setIsDismissed(true);
  }, []);

  const isInstallApplicable =
    !isSuppressedForDevelopment &&
    !isInstalled &&
    !isDismissed &&
    (canPromptNatively || isIOSManualInstall || isAndroidManualInstall);

  return {
    isInstalled,
    canPromptNatively,
    isIOSManualInstall,
    isAndroidManualInstall,
    isInstallApplicable,
    promptInstall,
    dismiss,
  };
}
