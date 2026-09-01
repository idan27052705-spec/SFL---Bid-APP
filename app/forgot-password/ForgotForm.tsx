"use client";

import { useState } from "react";

/**
 * Asking for a reset link.
 *
 * The reply is the same whether or not the address has an account, so
 * this page can't be used to find out who works here. That means the
 * success message has to be careful: it says "if that address has an
 * account", not "sent".
 */
export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong. Try again.");
      return;
    }
    setDone(data.message);
  }

  if (done)
    return (
      <div className="blueprint" style={{ padding: 20, display: "grid", gap: 8 }}>
        <h4 style={{ margin: 0 }}>Check your email</h4>
        <p style={{ fontSize: 14, margin: 0 }}>{done}</p>
        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Nothing after a few minutes? Look in spam, then ask the office to
          send you a new invitation.
        </p>
        <i className="corner tl" /><i className="corner tr" />
        <i className="corner bl" /><i className="corner br" />
      </div>
    );

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h4 style={{ margin: 0 }}>Forgotten password</h4>
      <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
        Type the address you sign in with and we&apos;ll email you a link to set
        a new password.
      </p>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
        />
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
