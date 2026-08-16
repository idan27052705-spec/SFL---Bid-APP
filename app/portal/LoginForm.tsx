"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STR, type Lang } from "@/lib/portalStrings";
import { COMPANY } from "@/app/config";

export default function LoginForm({
  lang,
  expired,
}: {
  lang: Lang;
  expired: boolean;
}) {
  const router = useRouter();
  const t = STR[lang];

  const [identifier, setIdentifier] = useState("");
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

    router.push("/portal/bids");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 20 }}>
      <h2 style={{ margin: 0 }}>{t.signIn}</h2>

      {expired && (
        <div
          className="card"
          style={{
            borderColor: "var(--color-accent)",
            background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
            fontSize: 14,
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
          style={{ minHeight: 48, fontSize: 16 }}
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
          style={{ minHeight: 48, fontSize: 22, letterSpacing: ".3em" }}
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
        <div className="text-muted" style={{ fontSize: 12, marginTop: 5 }}>
          {t.codeHint}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 14, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ minHeight: 48, fontSize: 16 }}
        type="submit"
        disabled={busy}
      >
        {busy ? "…" : t.signIn}
      </button>
    </form>
  );
}
