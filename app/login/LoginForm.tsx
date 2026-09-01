"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP, COMPANY } from "@/app/config";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "noprofile"
      ? "That account isn't attached to a company yet. Call the office."
      : null
  );
  const [busy, setBusy] = useState(false);

  /**
   * Only ever follow a path inside this app. "//evil.com" and
   * "https://evil.com" are both valid browser destinations, so a link
   * like /login?next=https://evil.com would otherwise hand someone
   * straight from our sign-in form to a copy of it.
   */
  function safeNext(next: string | null) {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (error) {
      setError("That email and password don't match.");
      return;
    }

    router.push(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{ width: "min(360px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Image src={APP.logo} alt={COMPANY.name} width={38} height={38} priority />
          <div style={{ lineHeight: 1.05 }}>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 18,
                letterSpacing: ".02em",
              }}
            >
              {APP.brandLine1}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
              }}
            >
              {APP.brandLine2}
            </div>
          </div>
        </div>

        <h4 style={{ margin: 0 }}>Sign in</h4>

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

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
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
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 13, textAlign: "center" }}>
          <a href="/forgot-password">Forgotten your password?</a>
        </div>

        <div className="text-muted" style={{ fontSize: 12, textAlign: "center" }}>
          Subcontractor?{" "}
          <a href="/portal">Use the sub portal</a> — you need your access code, not a password.
        </div>
      </form>
    </div>
  );
}
