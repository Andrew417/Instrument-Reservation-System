import { useState, useCallback } from "react";

export interface AppModalSequenceProps {
  isPolicyModalOpen: boolean;
  isInstallApplicable: boolean;
}

export interface AppModalSequenceState {
  showInstallPrompt: boolean;
  showPushPrompt: boolean;
  handleInstallModalClose: () => void;
}

/**
 * Enforces strict sequential popup presentation after user login:
 * 1. PolicyExplainerModal
 * 2. InstallAppPrompt (if applicable and not dismissed)
 * 3. PushNotificationPrompt
 *
 * Only one modal or prominent prompt renders at a time. The next prompt only
 * appears after the previous has been resolved (installed, dismissed, or not applicable).
 */
export function useAppModalSequence({
  isPolicyModalOpen,
  isInstallApplicable,
}: AppModalSequenceProps): AppModalSequenceState {
  const [isInstallSessionDismissed, setIsInstallSessionDismissed] =
    useState(false);

  const handleInstallModalClose = useCallback(() => {
    setIsInstallSessionDismissed(true);
  }, []);

  // Policy modal has top priority
  const isPolicyActive = isPolicyModalOpen;

  // Install prompt is active only if policy modal is resolved, install is applicable,
  // and the prompt has not been dismissed in the current session
  const showInstallPrompt =
    !isPolicyActive && isInstallApplicable && !isInstallSessionDismissed;

  // Push notification prompt is allowed only once both Policy and Install have resolved
  const showPushPrompt = !isPolicyActive && !showInstallPrompt;

  return {
    showInstallPrompt,
    showPushPrompt,
    handleInstallModalClose,
  };
}
