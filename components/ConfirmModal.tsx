"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

/**
 * The one confirm dialog in the app.
 *
 * It replaced the browser's confirm() box, which couldn't be styled or
 * translated and — on a phone — is easy to dismiss the wrong way. The
 * rules it enforces:
 *
 *   • the button says what happens ("Remove sub"), never "OK"
 *   • a destructive action is red, and Cancel is the safe default
 *   • the dialog names the thing being acted on, so you can see you
 *     picked the right row before you commit
 *
 * onConfirm may be async — the button shows a busy label until it
 * settles, so nothing gets double-tapped.
 */
export default function ConfirmModal({
  title,
  body,
  confirmLabel,
  busyLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  /** Defaults to the confirm label with an ellipsis. */
  busyLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={go}
            disabled={busy}
            style={
              danger
                ? { background: "#b3261e", borderColor: "#b3261e", color: "#fff" }
                : undefined
            }
          >
            {busy ? (busyLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{body}</div>
    </Modal>
  );
}
