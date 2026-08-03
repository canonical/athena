import { NotificationSeverity, useToastNotification } from "@canonical/react-components";
import { useEffect } from "react";

export type ToastFeedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

export const showToastFeedback = (toastNotify: ReturnType<typeof useToastNotification>, feedback: ToastFeedback): void => {
  if (feedback.severity === NotificationSeverity.NEGATIVE) {
    toastNotify.failure(feedback.title, new Error(feedback.message));
    return;
  }

  if (feedback.severity === NotificationSeverity.CAUTION) {
    toastNotify.caution(feedback.message, undefined, feedback.title);
    return;
  }

  toastNotify.info(feedback.message, feedback.title);
};

export const useFeedbackToast = (feedback: ToastFeedback | null, clearFeedback: (feedback: ToastFeedback | null) => void): ReturnType<typeof useToastNotification> => {
  const toastNotify = useToastNotification();

  useEffect(() => {
    if (!feedback) {
      return;
    }

    showToastFeedback(toastNotify, feedback);
    clearFeedback(null);
  }, [clearFeedback, feedback, toastNotify]);

  return toastNotify;
};
