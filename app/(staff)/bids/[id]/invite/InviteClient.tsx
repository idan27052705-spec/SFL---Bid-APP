"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Blueprint from "@/components/Blueprint";
import Modal from "@/components/Modal";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

export type InviteSub = {
  id: string;
  company: string;
  contact: string;
  city: string;
  email: string | null;
  already: boolean;
  stat: string;
};

export default function InviteClient({
  bidShortId,
  tradeName,
  subs,
  preview,
}: {
  bidShortId: number;
  tradeName: string;
  subs: InviteSub[];
  preview: { subject: string; email: string; sms: string };
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sent: string[];
    failed: { company: string; reason: string }[];
    issuedCodes: { company: string; code: string }[];
  } | null>(null);

  const selectable = useMemo(
    () => subs.filter((s) => !s.already && s.email),
    [subs]
  );
  const alreadyCount = subs.filter((s) => s.already).length;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleAll = () =>
    setPicked((p) => (p.length ? [] : selectable.map((s) => s.id)));

  async function send() {
    if (picked.length === 0) {
      setError("Pick at least one sub first.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bids/${bidShortId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subIds: picked }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Couldn't send. Try again.");
      return;
    }
    setResult(data);
    setPicked([]);
    router.refresh();
  }

  return (
    <>
      <div
        className="pagebody cols"
        style={{
          padding: "26px 28px 40px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1.3fr) minmax(320px,1fr)",
          gap: 26,
          alignItems: "start",
        }}
      >
        <Blueprint style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0 }}>{tradeName} subs</h4>
            <span style={{ fontSize: 12, color: MUTED }}>
              {selectable.length} available · {alreadyCount} already invited
            </span>
            {selectable.length > 0 && (
              <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={toggleAll}>
                {picked.length ? "Clear" : "Select all"}
              </button>
            )}
          </div>

          {subs.length === 0 && (
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              No {tradeName} subs on file yet. Add one and they&apos;ll appear here.
            </p>
          )}

          {subs.map((s) => (
            <label
              key={s.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: "11px 0",
                borderTop: HAIR,
                cursor: s.already || !s.email ? "default" : "pointer",
                opacity: s.already || !s.email ? 0.55 : 1,
              }}
            >
              <input
                type="checkbox"
                className="chk"
                checked={picked.includes(s.id)}
                disabled={s.already || !s.email}
                onChange={() => toggle(s.id)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.company}</div>
                <div style={{ fontSize: 12, color: MUTED }}>
                  {[s.contact, s.city, s.email || "no email on file"].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ fontSize: 12, textAlign: "right", color: MUTED }}>{s.stat}</div>
            </label>
          ))}
        </Blueprint>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Blueprint style={{ padding: "16px 18px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Email preview</h4>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
              Subject: {preview.subject}
            </div>
            <div
              style={{
                fontSize: 13,
                whiteSpace: "pre-line",
                borderTop: "1px solid var(--color-divider)",
                paddingTop: 10,
              }}
            >
              {preview.email}
            </div>
          </Blueprint>

          <Blueprint style={{ padding: "16px 18px" }}>
            <h4 style={{ margin: "0 0 10px" }}>SMS preview</h4>
            <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{preview.sms}</div>
            <div style={{ fontSize: 11, marginTop: 8, color: FAINT }}>
              {preview.sms.length} characters ·{" "}
              {Math.max(1, Math.ceil(preview.sms.length / 160))} segment
              {preview.sms.length > 160 ? "s" : ""} · text messaging isn&apos;t
              connected yet, so only the email goes out
            </div>
          </Blueprint>

          {error && (
            <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
              {error}
            </div>
          )}

          {selectable.length > 0 ? (
            <button
              className="btn btn-primary btn-block blueprint"
              onClick={send}
              disabled={busy}
            >
              {busy
                ? "Sending…"
                : picked.length === 1
                  ? "Send 1 invitation"
                  : `Send ${picked.length} invitations`}
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
            </button>
          ) : (
            <Blueprint style={{ padding: "14px 16px", fontSize: 13, color: MUTED }}>
              Every {tradeName} sub on file is already invited to this bid. Add a
              new sub to widen the list.
            </Blueprint>
          )}
        </div>
      </div>

      {result && (
        <Modal
          title={
            result.sent.length > 0
              ? `${result.sent.length} invitation${result.sent.length === 1 ? "" : "s"} sent`
              : "Nothing was sent"
          }
          onClose={() => {
            setResult(null);
            router.push(`/bids/${bidShortId}?tab=subs`);
          }}
          width={520}
          footer={
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                router.push(`/bids/${bidShortId}?tab=subs`);
              }}
            >
              Done
            </button>
          }
        >
          {result.sent.length > 0 && (
            <div style={{ fontSize: 14 }}>Emailed: {result.sent.join(", ")}</div>
          )}

          {result.issuedCodes.length > 0 && (
            <Blueprint style={{ padding: 12, borderColor: "var(--color-accent)" }}>
              <div className="card-kicker">New access codes issued</div>
              <div style={{ fontSize: 13, margin: "6px 0" }}>
                These subs had no code yet. It&apos;s in their email — write it
                down too, in case they call the office.
              </div>
              {result.issuedCodes.map((c) => (
                <div key={c.company} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                  <span style={{ flex: 1 }}>{c.company}</span>
                  <span className="mono" style={{ fontSize: 18, letterSpacing: ".12em" }}>
                    {c.code}
                  </span>
                </div>
              ))}
            </Blueprint>
          )}

          {result.failed.length > 0 && (
            <div style={{ fontSize: 13, color: "#b3261e" }}>
              Couldn&apos;t send to:{" "}
              {result.failed.map((f) => `${f.company} (${f.reason})`).join(", ")}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
