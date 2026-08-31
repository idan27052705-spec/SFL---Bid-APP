"use client";

import { useState } from "react";
import Modal, { ModalField } from "@/components/Modal";
import { money } from "@/lib/format";
import { MUTED } from "./sheet";
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
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  function confirm() {
    if (!reason.trim()) {
      setError("Say what needs fixing — the PM sees this.");
      return;
    }
    onConfirm(reason.trim());
    onClose();
  }

  return (
    <Modal
      title="Send back to the PM"
      subtitle={`${money(payment.amount)} to ${payment.payTo || "—"} · ${payment.reason}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={confirm}
            style={{ background: "#b3261e", borderColor: "#b3261e", color: "#fff" }}
          >
            Send back
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
    </Modal>
  );
}
