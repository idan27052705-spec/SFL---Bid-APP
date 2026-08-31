"use client";

import { useState } from "react";
import Modal, { ModalField } from "@/components/Modal";
import { money } from "@/lib/format";
import { DANGER, MUTED, errorLine } from "./sheet";
import { errorMessage } from "./PaymentsProvider";
import { dayOrAny, type PaymentRow } from "@/lib/payments";

/**
 * Sending a payment back to the PM.
 *
 * The reason is required. A row that comes back with no explanation just
 * turns into a phone call, which is the thing this whole screen exists to
 * replace — and the PM sees this text on their own row.
 */
export default function RejectModal({
  payment,
  onConfirm,
  onClose,
}: {
  payment: PaymentRow;
  /** Sends it back. Throws with the server's words if it refuses. */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    if (!reason.trim()) {
      setError("Say what needs fixing — the PM sees this.");
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Send back to the PM"
      subtitle={`${money(payment.amount)} to ${payment.payTo || "—"} · ${payment.reason}`}
      onClose={busy ? () => {} : onClose}
      width={520}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={confirm}
            disabled={busy}
            style={{ background: DANGER, borderColor: DANGER, color: "#fff" }}
          >
            {busy ? "Sending back…" : "Send back"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: MUTED }}>
        Scheduled for {dayOrAny(payment.date)} · {payment.projectName} ·{" "}
        {payment.pmName}
      </div>

      <ModalField
        id="reject-reason"
        label="What needs fixing"
        required
        textarea
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(undefined);
        }}
        error={error}
        placeholder="Amount doesn't match the approved quote — should be $8,400."
      />

      <div style={{ fontSize: 12, color: MUTED }}>
        {payment.pmName} will see this on the row. Editing it puts the payment
        straight back in your queue.
      </div>

      {failed && <div style={errorLine}>{failed}</div>}
    </Modal>
  );
}
