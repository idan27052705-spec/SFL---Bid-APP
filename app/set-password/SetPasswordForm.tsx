"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Choosing a password from a one-time link.
 *
 * Used both by a new teammate opening their invitation and by anyone who
 * forgot theirs — one screen, because it is the same moment: the link
 * proved they can read that inbox, now they pick a password.
 *
 * The link is spent as soon as it is used, so an expired or reused link
 * has to say so plainly and offer the way back, rather than failing with
 * something the person can't act on.
 */
export default function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.status === 410) {
      setExpired(true);
      return;
    }
    if (!res.ok) {
      setError(data.error || "Couldn't set that password.");
      return;
    }

    setDone(true);
    // The link signed them in, so there is nowhere to send them but in.
    router.push("/");
    router.refresh();
  }

  if (!token || expired)
    return (
      <div className="blueprint" style={{ padding: 20, display: "grid", gap: 10 }}>
        <h4 style={{ margin: 0 }}>That link has expired</h4>
        <p style={{ fontSize: 14, margin: 0 }}>
          These links last an hour and only work once. Ask for a new one and
          it&apos;ll be in your inbox in a minute.
        </p>
        <Link className="btn btn-primary btn-block" href="/forgot-password">
          Send me a new link
        </Link>
        <i className="corner tl" /><i className="corner tr" />
        <i className="corner bl" /><i className="corner br" />
      </div>
    );

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h4 style={{ margin: 0 }}>Set your password</h4>
      <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
        Pick something only you know. You&apos;ll use it with your email address
        from now on.
      </p>

      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          At least 8 characters.
        </div>
      </div>

      <div className="field">
        <label htmlFor="confirm">Type it again</label>
        <input
          id="confirm"
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
        />
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy || done}>
        {busy ? "Saving…" : done ? "Signing you in…" : "Save password and sign in"}
      </button>
    </form>
  );
}
