"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STR, type Lang } from "@/lib/portalStrings";
import { timeAgo } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

const FIELDS = ["Company name", "Contact name", "Email", "Phone", "City"];

export default function ProfileForm({
  lang,
  requests,
}: {
  lang: Lang;
  requests: { id: string; field: string; value: string; status: string; created_at: string }[];
}) {
  const router = useRouter();
  const t = STR[lang];

  const [field, setField] = useState(FIELDS[0]);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send() {
    if (!value.trim()) {
      setError(t.newValue);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value, note, lang }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setValue("");
    setNote("");
    setDone(data.message);
    router.refresh();
  }

  const big = { minHeight: 48, fontSize: 16 } as const;

  return (
    <>
      <div className="blueprint" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h4 style={{ margin: 0 }}>{t.askChange}</h4>
          <div style={{ fontSize: 13, color: MUTED }}>{t.changeHint}</div>
        </div>

        <div className="field">
          <label htmlFor="field">{t.whatField}</label>
          <select id="field" className="input" style={big} value={field} onChange={(e) => setField(e.target.value)}>
            {FIELDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="value">{t.newValue}</label>
          <input
            id="value"
            className="input"
            style={big}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="note">{t.notes}</label>
          <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "10px 12px" }}>
            {error}
          </div>
        )}
        {done && (
          <div style={{ fontSize: 14, color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "10px 12px" }}>
            {done}
          </div>
        )}

        <button className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} onClick={send} disabled={busy}>
          {busy ? t.sending : t.sendRequest}
        </button>

        <i className="corner tl" /><i className="corner tr" />
        <i className="corner bl" /><i className="corner br" />
      </div>

      {requests.length > 0 && (
        <div className="blueprint" style={{ padding: 22 }}>
          <h4 style={{ margin: "0 0 8px" }}>{t.pendingTitle}</h4>
          {requests.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: HAIR, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: MUTED }}>{r.field}</span> →{" "}
                  <span style={{ fontWeight: 500 }}>{r.value}</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED }}>{timeAgo(r.created_at)}</div>
              </div>
              <span className={r.status === "Approved" ? "tag tag-accent" : "tag tag-neutral"}>
                {r.status}
              </span>
            </div>
          ))}
          <i className="corner tl" /><i className="corner tr" />
          <i className="corner bl" /><i className="corner br" />
        </div>
      )}
    </>
  );
}
