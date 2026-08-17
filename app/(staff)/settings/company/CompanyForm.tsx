"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Blueprint from "@/components/Blueprint";
import { type CompanyDetails, companyFooter } from "@/lib/company";

/**
 * Defined at module level on purpose — a component declared inside render
 * is a new type every keystroke, which remounts the input and throws the
 * cursor out of the field.
 */
function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: "#b3261e" }}> *</span>}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: "#b3261e" } : undefined}
      />
      {error ? (
        <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const ROW: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0 18px",
};

export default function CompanyForm({
  company,
  canEdit,
}: {
  company: CompanyDetails;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(company);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof CompanyDetails) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setSaved(false);
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      delete n.form;
      return n;
    });
  };

  async function save() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Company name is required.";
    const ok = (v: string) => !v.trim() || /^\S+@\S+\.\S+$/.test(v.trim());
    if (!ok(form.fromEmail)) next.fromEmail = "That doesn't look like a valid email.";
    if (!ok(form.replyTo)) next.replyTo = "That doesn't look like a valid email.";

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErrors({ form: data.error || "Couldn't save. Try again." });
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
      {!canEdit && (
        <div className="card" style={{ fontSize: 13 }}>
          Only the owner can change these. You can see them here so you know
          what the subs see.
        </div>
      )}

      <Blueprint style={{ padding: 20 }}>
        <h4 style={{ margin: "0 0 14px" }}>Company</h4>

        <Field
          id="name"
          label="Company name"
          required
          disabled={!canEdit}
          value={form.name}
          onChange={set("name")}
          error={errors.name}
          hint="Shown at the top of every email and in the sub portal."
        />

        <div style={ROW}>
          <Field
            id="phone"
            label="Office phone"
            disabled={!canEdit}
            value={form.phone}
            onChange={set("phone")}
            placeholder="(954) 555-0100"
            hint="Subs are told to call this with questions."
          />
          <Field
            id="licenseNumber"
            label="License number"
            disabled={!canEdit}
            value={form.licenseNumber}
            onChange={set("licenseNumber")}
            placeholder="CGC1234567"
          />
        </div>

        <div style={ROW}>
          <Field
            id="website"
            label="Website"
            disabled={!canEdit}
            value={form.website}
            onChange={set("website")}
            placeholder="sflbuildersgroup.com"
          />
          <Field
            id="region"
            label="Region"
            disabled={!canEdit}
            value={form.region}
            onChange={set("region")}
            placeholder="South Florida"
            hint="Used when no address is filled in."
          />
        </div>
      </Blueprint>

      <Blueprint style={{ padding: 20 }}>
        <h4 style={{ margin: "0 0 14px" }}>Office address</h4>

        <Field
          id="address"
          label="Street address"
          disabled={!canEdit}
          value={form.address}
          onChange={set("address")}
          placeholder="1200 NW 2nd Ave, Suite 300"
        />

        <div style={ROW}>
          <Field
            id="city"
            label="City"
            disabled={!canEdit}
            value={form.city}
            onChange={set("city")}
            placeholder="Fort Lauderdale"
          />
          <Field
            id="state"
            label="State"
            disabled={!canEdit}
            value={form.state}
            onChange={set("state")}
            placeholder="FL"
          />
          <Field
            id="zip"
            label="ZIP"
            disabled={!canEdit}
            value={form.zip}
            onChange={set("zip")}
            placeholder="33311"
          />
        </div>
      </Blueprint>

      <Blueprint style={{ padding: 20 }}>
        <h4 style={{ margin: "0 0 6px" }}>Email addresses</h4>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          The &quot;from&quot; address has to be on a domain verified with
          Resend, or the email won&apos;t send. Replies go to the reply-to
          address, so put the inbox you actually read there.
        </p>

        <div style={ROW}>
          <Field
            id="fromEmail"
            label="Send from"
            disabled={!canEdit}
            value={form.fromEmail}
            onChange={set("fromEmail")}
            error={errors.fromEmail}
            placeholder="bids@sflbuildersgroup.com"
          />
          <Field
            id="replyTo"
            label="Replies go to"
            disabled={!canEdit}
            value={form.replyTo}
            onChange={set("replyTo")}
            error={errors.replyTo}
            placeholder="office@sflbuildersgroup.com"
          />
        </div>
      </Blueprint>

      {/* What a sub actually sees at the bottom of an email. */}
      <div className="card" style={{ gap: 6 }}>
        <div className="card-kicker">Email footer preview</div>
        <div style={{ fontSize: 13 }}>{companyFooter(form)}</div>
      </div>

      {errors.form && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {errors.form}
        </div>
      )}

      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: "var(--color-accent-700)" }}>
              Saved.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
