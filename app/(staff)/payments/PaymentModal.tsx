"use client";

import { useState } from "react";
import Modal, { ModalField } from "@/components/Modal";
import { dayLabel, weekDays } from "@/lib/weeks";
import type { PM, PaymentRow, Project } from "@/lib/payments";

/**
 * A select that carries an id, not just its label — the house ModalField
 * only does string options, and the day has to save as a date.
 */
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: "#b3261e" }}> *</span>}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: "#b3261e" } : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/**
 * Add or edit one expected payment.
 *
 * Project and Pay to are plain typed text. A PM logging twelve payments
 * knows the names by heart and types faster than they can work a list,
 * and a payment to a supplier nobody has entered yet must never be
 * blocked by one.
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
  onSave: (row: PaymentRow) => void;
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

  const clear = (key: string) =>
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });

  function validate() {
    const next: Record<string, string> = {};
    if (!projectName.trim()) next.project = "Type the project this payment is for.";
    if (!date) next.date = "Pick the day it is expected to go out.";
    if (!reason.trim()) next.reason = "Say what the payment is for.";

    const n = Number(amount);
    if (!amount.trim()) next.amount = "Amount is required.";
    else if (!Number.isFinite(n) || n <= 0) next.amount = "Enter an amount above zero.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function rowFrom(id: string): PaymentRow {
    const typed = projectName.trim();
    // Keep the link to the real project when the typed name matches one we
    // know, so wiring this to the database later doesn't lose it.
    const known = projects.find(
      (p) => p.name.toLowerCase() === typed.toLowerCase()
    );
    const pm = pms.find((p) => p.id === pmId) ?? me;

    return {
      id,
      weekStart,
      date,
      pmId: pm.id,
      pmName: pm.name,
      projectId: known?.id ?? null,
      projectName: known?.name ?? typed,
      payTo: payTo.trim(),
      reason: reason.trim(),
      amount: Number(amount),
    };
  }

  const newId = () => `new-${pmId}-${date}-${Date.now()}-${added}`;

  function save() {
    if (!validate()) return;
    onSave(rowFrom(payment?.id ?? newId()));
    onClose();
  }

  /** Keeps the project and the day; clears what changes payment to payment. */
  function saveAndAddAnother() {
    if (!validate()) return;
    onSave(rowFrom(newId()));
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
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!editing && (
            <button className="btn btn-secondary" onClick={saveAndAddAnother}>
              Save &amp; add another
            </button>
          )}
          <button className="btn btn-primary" onClick={save}>
            {editing ? "Save changes" : "Save"}
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

      <SelectField
        id="pay-day"
        label="Expected day"
        required
        value={date}
        onChange={(v) => {
          setDate(v);
          clear("date");
        }}
        error={errors.date}
        placeholder="Select a day"
        options={days.map((d) => ({ value: d, label: dayLabel(d) }))}
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
    </Modal>
  );
}
