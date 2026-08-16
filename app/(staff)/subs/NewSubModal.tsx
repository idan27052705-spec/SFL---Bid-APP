"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal, { ModalField } from "@/components/Modal";

export type Trade = { id: string; name: string };

const EMPTY = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
};

export default function NewSubModal({
  trades,
  onClose,
}: {
  trades: Trade[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [tradeIds, setTradeIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ code: string; name: string } | null>(null);

  const set = (key: keyof typeof EMPTY) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      delete n.form;
      return n;
    });
  };

  const toggleTrade = (id: string) => {
    setTradeIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
    setErrors((e) => {
      const n = { ...e };
      delete n.trades;
      return n;
    });
  };

  async function save() {
    const next: Record<string, string> = {};
    if (!form.companyName.trim()) next.companyName = "Company name is required.";
    if (!form.email.trim()) next.email = "Email is required — it's how they sign in.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      next.email = "That doesn't look like a valid email address.";
    if (tradeIds.length === 0) next.trades = "Pick at least one trade.";

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/subs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tradeIds }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrors({ form: data.error || "Couldn't save. Try again." });
      return;
    }

    setIssued({ code: data.code, name: data.sub.company_name });
    router.refresh();
  }

  // After saving, the code is shown once — it can never be read back.
  if (issued) {
    return (
      <Modal
        title="Access code issued"
        subtitle={`${issued.name} signs in with their email and this code.`}
        onClose={onClose}
        footer={
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <div
          className="mono"
          style={{
            fontSize: 40,
            letterSpacing: ".18em",
            textAlign: "center",
            padding: "18px 0",
            border: "1px solid var(--color-divider)",
          }}
        >
          {issued.code}
        </div>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>Write this down or text it now.</strong> It&apos;s stored
          scrambled, so nobody — not even you — can read it back later. If it
          gets lost, issue a new one from the sub&apos;s page.
        </p>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          Once email sending is switched on, the code goes out automatically with
          every bid invitation.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => navigator.clipboard?.writeText(issued.code)}
        >
          Copy code
        </button>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add subcontractor"
      subtitle="They get an access code for the sub portal — no password to remember."
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Adding…" : "Add sub"}
          </button>
        </>
      }
    >
      <ModalField
        id="companyName"
        label="Company name"
        required
        value={form.companyName}
        onChange={set("companyName")}
        error={errors.companyName}
        placeholder="Sunrise Plumbing Inc."
      />

      <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField
          id="contactName"
          label="Contact name"
          value={form.contactName}
          onChange={set("contactName")}
          placeholder="Carlos Betancourt"
        />
        <ModalField
          id="city"
          label="City"
          value={form.city}
          onChange={set("city")}
          placeholder="Fort Lauderdale"
        />
      </div>

      <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField
          id="email"
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          placeholder="carlos@sunriseplumbingfl.com"
        />
        <ModalField
          id="phone"
          label="Phone"
          value={form.phone}
          onChange={set("phone")}
          placeholder="(954) 555-0142"
        />
      </div>

      <div className="field">
        <label>
          Trades<span style={{ color: "#b3261e" }}> *</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {trades.map((t) => {
            const on = tradeIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className="btn"
                onClick={() => toggleTrade(t.id)}
                style={{
                  fontSize: 13,
                  padding: "5px 10px",
                  background: on
                    ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                    : "transparent",
                  borderColor: on ? "var(--color-accent)" : "var(--color-divider)",
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
        {errors.trades && (
          <div style={{ fontSize: 12, color: "#b3261e", marginTop: 6 }}>
            {errors.trades}
          </div>
        )}
        <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Trades decide which bid packages you can invite them to.
        </div>
      </div>

      {errors.form && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {errors.form}
        </div>
      )}
    </Modal>
  );
}
