"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/mail-ui";

type Feedback = {
  message: string;
  kind: "confirm" | "info" | "success" | "error";
};

/** Shared presentation for existing admin confirmations and API feedback. */
export function useAdminFeedback() {
  const [notice, setNotice] = useState<Feedback | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const resolveConfirmation = useRef<((confirmed: boolean) => void) | null>(
    null,
  );

  useEffect(() => () => resolveConfirmation.current?.(false), []);

  const rememberFocus = () => {
    const active = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const parentDialog = dialogs.item(dialogs.length - 1);
    // Disabling a submit button during a request can move focus to the body.
    // In that case, return error feedback to the still-open form.
    returnFocusRef.current =
      active && active !== document.body
        ? active
        : parentDialog?.querySelector<HTMLElement>("input, select, button") ||
          null;
  };

  const close = (confirmed = false) => {
    resolveConfirmation.current?.(confirmed);
    resolveConfirmation.current = null;
    setNotice(null);
  };
  const notify = (
    message: string,
    kind: "info" | "success" | "error" = "info",
  ) => {
    rememberFocus();
    resolveConfirmation.current?.(false);
    resolveConfirmation.current = null;
    setNotice({ message, kind });
  };
  const confirmAction = (message: string) => {
    rememberFocus();
    resolveConfirmation.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveConfirmation.current = resolve;
      setNotice({ message, kind: "confirm" });
    });
  };

  const confirming = notice?.kind === "confirm";
  const Icon = confirming
    ? Trash2
    : notice?.kind === "error"
      ? AlertCircle
      : notice?.kind === "success"
        ? CheckCircle2
        : Info;
  const title = confirming
    ? "Confirm deletion"
    : notice?.kind === "error"
      ? "Unable to complete action"
      : notice?.kind === "success"
        ? "Changes saved"
        : "Administration update";

  const feedback = (
    <Modal
      open={notice !== null}
      onClose={() => close()}
      title={title}
      className="admin-dialog"
      returnFocusRef={returnFocusRef}
    >
      <div className="overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Icon
            size={22}
            aria-hidden="true"
            className={`mt-0.5 shrink-0 ${confirming || notice?.kind === "error" ? "text-destructive" : "text-primary"}`}
          />
          <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {notice?.message}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t p-4">
        {confirming ? (
          <>
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-secondary"
              onClick={() => close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              onClick={() => close(true)}
            >
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => close()}
          >
            Done
          </button>
        )}
      </div>
    </Modal>
  );

  return { notify, confirmAction, feedback };
}
