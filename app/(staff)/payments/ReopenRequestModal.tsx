"use client";

import { useState } from "react";
import Modal, { ModalField } from "@/components/Modal";
import { weekLabel } from "@/lib/weeks";
import { MUTED, errorLine } from "./sheet";
import { errorMessage } from "./PaymentsProvider";

/**
 * Asking for a week you already handed in to be unlocked.
 *
 * The reason is required because it is the whole request. Nobody unlocks a
 * signed week on the strength of "please reopen" — the admin is weighing a
 * missed payment against a report finance may already be paying from, and
 * they can only do that if they know which one it is. It is also what the
 * week has to show afterwards for why it was opened again.
 */
export default function ReopenRequestModal({
  week,
  onConfirm,
  onClose,
}: {
  week: string;
  /** Sends the ask. Throws with the server's words if it refuses. */
  onConfirm: (message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    if (!message.trim()) {
      setError("Say what you need to change — the approval turns on this.");
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await onConfirm(message.trim());
      onClose();
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Request to reopen"
      subtitle={weekLabel(week)}
      onClose={busy ? () => {} : onClose}
      width={520}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: MUTED }}>
        Your week stays submitted until this is answered. Nothing you already
        entered is lost.
      </div>

      <ModalField
        id="reopen-message"
        label="Why do you need it reopened?"
        required
        textarea
        value={message}
        onChange={(v) => {
          setMessage(v);
          setError(undefined);
        }}
        error={error}
        placeholder="Missed Thursday's concrete pour — $6,200 to Costa Concrete."
      />

      <div style={{ fontSize: 12, color: MUTED }}>
        Whoever handles the payments approves or declines this. If it is
        approved the week goes back to draft and you submit it again.
      </div>

      {failed && <div style={errorLine}>{failed}</div>}
    </Modal>
  );
}
