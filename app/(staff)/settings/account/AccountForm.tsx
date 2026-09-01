"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  name: string;
  email: string;
  role: string;
  companyName: string;
};

const ROLE_COPY: Record<string, string> = {
  admin: "Admin — full access to every page, including team and company settings.",
  pm: "Project manager — sees only the pages an admin has given you.",
};

/**
 * Defined at module level on purpose. A component declared inside the render
 * function is a new type on every keystroke, so React remounts the input and
 * the cursor jumps out of the field.
 */
function Field({
  id,
  label,
  type = "text",
  value,
  error,
  hint,
  required,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={onChange}
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

export default function AccountForm({ name, email, role, companyName }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    name,
    email,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((x) => {
      const next = { ...x };
      delete next[key];
      return next;
    });
    setNotice(null);
  };

  const emailChanged = form.email.trim().toLowerCase() !== email.toLowerCase();
  const passwordChanged = form.newPassword.length > 0;
  const nameChanged = form.name.trim() !== name;
  const nothingToSave = !emailChanged && !passwordChanged && !nameChanged;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      next.email = "That doesn't look like a valid email address.";

    if (passwordChanged) {
      if (form.newPassword.length < 8)
        next.newPassword = "Use at least 8 characters.";
      if (form.confirmPassword !== form.newPassword)
        next.confirmPassword = "The two passwords don't match.";
    }
    if ((emailChanged || passwordChanged) && !form.currentPassword)
      next.currentPassword =
        "Enter your current password to change your email or password.";

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setBusy(true);
    setNotice(null);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        newPassword: form.newPassword || undefined,
        currentPassword: form.currentPassword || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrors({ form: data.error || "Couldn't save. Try again." });
      return;
    }

    setForm((f) => ({
      ...f,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
    setNotice(
      data.passwordChanged && data.emailChanged
        ? "Saved. Use your new email and password next time you sign in."
        : data.passwordChanged
          ? "Password changed. Use it next time you sign in."
          : data.emailChanged
            ? "Saved. Sign in with your new email address next time."
            : "Saved."
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: 18, maxWidth: 520 }}
    >
      <div className="card" style={{ gap: 14 }}>
        <div className="card-kicker">Your details</div>

        <Field
          id="name"
          label="Full name"
          value={form.name}
          error={errors.name}
          onChange={set("name")}
          required
        />
        <Field
          id="email"
          error={errors.email}
          onChange={set("email")}
          label="Email"
          type="email"
          value={form.email}
          required
          autoComplete="username"
          hint="This is the email you sign in with."
        />

        <div className="field">
          <label>Role</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="tag tag-accent" style={{ textTransform: "capitalize" }}>
              {role}
            </span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {companyName}
            </span>
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {ROLE_COPY[role]}{" "}
            {role === "admin"
              ? "You change anyone's role and access on the Team & roles page."
              : "Only an admin can change your role or open more pages for you — ask the office."}
          </div>
        </div>
      </div>

      <div className="card" style={{ gap: 14 }}>
        <div className="card-kicker">Change password</div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: -4 }}>
          Leave these blank if you only want to change your name.
        </div>

        <Field
          id="newPassword"
          error={errors.newPassword}
          onChange={set("newPassword")}
          label="New password"
          type="password"
          value={form.newPassword}
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <Field
          id="confirmPassword"
          error={errors.confirmPassword}
          onChange={set("confirmPassword")}
          label="Confirm new password"
          type="password"
          value={form.confirmPassword}
          autoComplete="new-password"
        />
      </div>

      {(emailChanged || passwordChanged) && (
        <div className="card" style={{ gap: 14 }}>
          <div className="card-kicker">Confirm it&apos;s you</div>
          <Field
            id="currentPassword"
          error={errors.currentPassword}
          onChange={set("currentPassword")}
            label="Current password"
            type="password"
            value={form.currentPassword}
            required
            autoComplete="current-password"
            hint="Required because you're changing your email or password."
          />
        </div>
      )}

      {errors.form && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {errors.form}
        </div>
      )}
      {notice && (
        <div style={{ fontSize: 13, color: "var(--color-accent-800)" }} role="status">
          {notice}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy || nothingToSave}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {!nothingToSave && !busy && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setForm({
                name,
                email,
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
              });
              setErrors({});
              setNotice(null);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
