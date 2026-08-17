"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STR, type Lang } from "@/lib/portalStrings";
import { COMPANY } from "@/app/config";

export default function LoginForm({
  lang,
  expired,
  email: prefill,
}: {
  lang: Lang;
  expired: boolean;
  email?: string;
}) {
  const router = useRouter();
  const t = STR[lang];

  const [identifier, setIdentifier] = useState(prefill ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await fetch("/api/portal/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code, lang }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error || t.badLogin);
      return;
    }

    router.push(data.redirect || "/portal/bids");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      style={{
        width: "min(100%, 460px)",
        margin: "0 auto",
        padding: "56px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <h1 style={{ fontSize: 36, margin: 0 }}>{t.signIn}</h1>
        <div style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          {t.codeHint}
        </div>
      </div>

      <div className="blueprint" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>

      {expired && (
        <div
          style={{
            fontSize: 13,
            color: "var(--color-accent-800)",
            background: "var(--color-accent-100)",
            padding: "10px 12px",
          }}
        >
          That link has expired. Sign in with your access code, or call the
          office at {COMPANY.phone}.
        </div>
      )}

      <div className="field">
        <label htmlFor="identifier">{t.email}</label>
        <input
          id="identifier"
          className="input"
          style={{ minHeight: 50, fontSize: 16 }}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setError(null);
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="code">{t.code}</label>
        <input
          id="code"
          className="input mono"
          style={{ minHeight: 50, fontSize: 22, letterSpacing: ".3em" }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
      </div>

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "var(--color-accent-800)",
            background: "var(--color-accent-100)",
            padding: "10px 12px",
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ minHeight: 54, fontSize: 17 }}
        type="submit"
        disabled={busy}
      >
        {busy ? "…" : t.signIn}
      </button>

        <i className="corner tl" /><i className="corner tr" />
        <i className="corner bl" /><i className="corner br" />
      </div>
    </form>
  );
}
