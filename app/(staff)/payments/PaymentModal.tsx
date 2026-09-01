"use client";

import { useState } from "react";
import Modal, { ModalField } from "@/components/Modal";
import SelectField from "./SelectField";
import { errorLine } from "./sheet";
import { errorMessage, type PaymentDraft } from "./PaymentsProvider";
import { dayLabel, weekDays } from "@/lib/weeks";
import type { PM, PaymentRow, Project } from "@/lib/payments";

/**
 * Add or edit one expected payment.
 *
 * Project and Pay to are plain typed text. A PM logging twelve payments
 * knows the names by heart and types faster than they can work a list,
 * and a payment to a supplier nobody has entered yet must never be
 * blocked by one.
 *
 * The day is a choice, not a requirement. A PM usually knows the week and
 * not the morning, and a required day only buys a made-up Monday on every
 * row — so "Any day this week" is a real answer and saves as no day.
 *
 * "Save & add another" is the button that matters here. The project and
 * the day are usually the same for several payments in a row, so those
 * two stay filled and everything else clears — closing and reopening the
 * dialog twelve times is what would make people stop doing this.
 */
export default function PaymentModal({
  weekStart,
  projects,
  pms,
  me,
  canPickPm,
  payment,
  onSave,
  onClose,
}: {
  weekStart: string;
  projects: Project[];
  pms: PM[];
  me: PM;
  canPickPm: boolean;
  payment?: PaymentRow;
  /** Saves it. Throws with the server's words if the save is refused. */
  onSave: (draft: PaymentDraft) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!payment;
  const days = weekDays(weekStart);

  const [projectName, setProjectName] = useState(payment?.projectName ?? "");
  const [date, setDate] = useState(payment?.date ?? "");
  const [payTo, setPayTo] = useState(payment?.payTo ?? "");
  const [reason, setReason] = useState(payment?.reason ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [pmId, setPmId] = useState(payment?.pmId ?? me.id);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const clear = (key: string) =>
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });

  function validate() {
    const next: Record<string, string> = {};
    if (!projectName.trim()) next.project = "Type the project this payment is for.";
    if (!reason.trim()) next.reason = "Say what the payment is for.";

    const n = Number(amount);
    if (!amount.trim()) next.amount = "Amount is required.";
    else if (!Number.isFinite(n) || n <= 0) next.amount = "Enter an amount above zero.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /**
   * What was typed, as the API takes it. An id means the row already
   * exists; without one this is a new payment.
   */
  function draftFrom(id?: string): PaymentDraft {
    const typed = projectName.trim();
    // Keep the link to the real project when the typed name matches one we
    // know, so a payment that names a project of ours stays attached to it.
    const known = projects.find(
      (p) => p.name.toLowerCase() === typed.toLowerCase()
    );
    const pm = pms.find((p) => p.id === pmId) ?? me;

    return {
      id,
      weekStart,
      // Empty means the PM picked "Any day this week", which is a day of
      // its own — not a blank waiting to be filled in.
      date: date || null,
      pmId: pm.id,
      projectId: known?.id ?? null,
      projectName: known?.name ?? typed,
      payTo: payTo.trim(),
      reason: reason.trim(),
      amount: Number(amount),
    };
  }

  /** Saves, and says so if the server refused — never closes on a failure. */
  async function commit(draft: PaymentDraft): Promise<boolean> {
    setBusy(true);
    setFailed(null);
    try {
      await onSave(draft);
      return true;
    } catch (e) {
      setFailed(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!validate()) return;
    if (await commit(draftFrom(payment?.id))) onClose();
  }

  /** Keeps the project and the day; clears what changes payment to payment. */
  async function saveAndAddAnother() {
    if (!validate()) return;
    if (!(await commit(draftFrom()))) return;
    setPayTo("");
    setReason("");
    setAmount("");
    setErrors({});
    setAdded((n) => n + 1);
    document.getElementById("pay-to")?.focus();
  }

  return (
    <Modal
      title={editing ? "Edit payment" : "Add payment"}
      subtitle={
        added > 0
          ? `${added} payment${added === 1 ? "" : "s"} added — project and day kept`
          : "Expected payment for this week"
      }
      onClose={busy ? () => {} : onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {!editing && (
            <button
              className="btn btn-secondary"
              onClick={saveAndAddAnother}
              disabled={busy}
            >
              Save &amp; add another
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save"}
          </button>
        </>
      }
    >
      <ModalField
        id="pay-project"
        label="Project"
        required
        value={projectName}
        onChange={(v) => {
          setProjectName(v);
          clear("project");
        }}
        error={errors.project}
        placeholder="Las Olas Residence"
      />

      {/*
        "Any day this week" is the first option rather than a placeholder:
        it is an answer, and the empty value is what gets saved for it.
      */}
      <SelectField
        id="pay-day"
        label="Expected day"
        value={date}
        onChange={setDate}
        options={[
          { value: "", label: "Any day this week" },
          ...days.map((d) => ({ value: d, label: dayLabel(d) })),
        ]}
      />

      <ModalField
        id="pay-to"
        label="Pay to"
        value={payTo}
        onChange={setPayTo}
        placeholder="ABC Plumbing"
      />

      <ModalField
        id="pay-reason"
        label="Reason for pay"
        required
        value={reason}
        onChange={(v) => {
          setReason(v);
          clear("reason");
        }}
        error={errors.reason}
        placeholder="Plumbing rough-in — draw 2"
      />

      <ModalField
        id="pay-amount"
        label="Amount ($)"
        required
        type="number"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          clear("amount");
        }}
        error={errors.amount}
        placeholder="12400"
      />

      {canPickPm && (
        <SelectField
          id="pay-pm"
          label="Project manager"
          value={pmId}
          onChange={setPmId}
          options={pms.map((p) => ({
            value: p.id,
            label: p.id === me.id ? `${p.name} (you)` : p.name,
          }))}
        />
      )}

      {failed && <div style={errorLine}>{failed}</div>}
    </Modal>
  );
}
