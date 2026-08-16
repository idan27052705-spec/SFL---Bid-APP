"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import Modal from "@/components/Modal";
import { timeAgo } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

/* ── Header button: open the portal as this sub ── */
export function PreviewAsSubButton({ shortId }: { shortId: number }) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const res = await fetch(`/api/subs/${shortId}/preview`, { method: "POST" });
    setBusy(false);
    if (res.ok) window.open("/portal/bids", "_blank", "noopener");
  }

  return (
    <button className="btn btn-primary blueprint" onClick={go} disabled={busy}>
      <Smartphone size={15} /> Preview as sub
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </button>
  );
}

/* ── Access code panel ── */
export function AccessCodePanel({
  shortId,
  companyName,
  code,
  hasCode,
  canWrite,
}: {
  shortId: number;
  companyName: string;
  code: string | null;
  hasCode: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/subs/${shortId}/code`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Couldn't issue a new code.");
      return;
    }
    setConfirming(false);
    setIssued(data.code);
    router.refresh();
  }

  return (
    <>
      <h4 style={{ margin: "0 0 6px" }}>Portal access code</h4>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
        Paired with their email or phone at login.
      </div>

      {code ? (
        <div
          className="mono"
          style={{ fontSize: 34, letterSpacing: ".22em", fontWeight: 600, lineHeight: 1.1 }}
        >
          {code}
        </div>
      ) : hasCode ? (
        <div style={{ fontSize: 13, color: MUTED }}>
          Issued before codes could be shown. Regenerate to see it.
        </div>
      ) : (
        <div style={{ fontSize: 13, color: MUTED }}>No code issued yet.</div>
      )}

      {error && <div style={{ fontSize: 12, color: "#b3261e", marginTop: 6 }}>{error}</div>}

      {canWrite && (
        <button className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
          Regenerate code
        </button>
      )}

      <div style={{ fontSize: 11, marginTop: 8, color: FAINT }}>
        Regenerating logs them out everywhere and invalidates the old code.
      </div>

      {confirming && (
        <Modal
          title="Regenerate access code?"
          subtitle={companyName}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={regenerate} disabled={busy}>
                {busy ? "Issuing…" : "Regenerate"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            Their old code stops working immediately, every link in every email
            you&apos;ve sent them dies, and if they&apos;re signed into the portal
            they get signed out.
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Use this if a code reached the wrong person, or someone left the
            company.
          </p>
        </Modal>
      )}

      {issued && (
        <Modal
          title="New access code"
          subtitle={`${companyName} signs in with their email and this code.`}
          onClose={() => setIssued(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setIssued(null)}>
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
            {issued}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard?.writeText(issued)}
          >
            Copy code
          </button>
        </Modal>
      )}
    </>
  );
}

/* ── Requested changes ── */
export type ChangeRequest = {
  id: string;
  field: string;
  value: string;
  note: string | null;
  status: string;
  createdAt: string;
};

export function RequestedChanges({
  requests,
  canWrite,
}: {
  requests: ChangeRequest[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: string, approve: boolean) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/change-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) setError(data.error || "Couldn't save that.");
    router.refresh();
  }

  return (
    <>
      <h4 style={{ margin: "0 0 4px" }}>Requested changes</h4>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
        Submitted from the sub portal. Nothing changes until you approve.
      </div>

      {error && <div style={{ fontSize: 12, color: "#b3261e" }}>{error}</div>}

      {requests.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px 0",
            borderTop: HAIR,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14 }}>
              <span style={{ color: MUTED }}>{c.field}</span> →{" "}
              <span style={{ fontWeight: 500 }}>{c.value}</span>
            </div>
            <div style={{ fontSize: 12, color: FAINT }}>
              {[c.note, timeAgo(c.createdAt)].filter(Boolean).join(" · ")}
            </div>
          </div>

          {c.status === "Pending" && canWrite ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                disabled={busy === c.id}
                onClick={() => resolve(c.id, false)}
              >
                Decline
              </button>
              <button
                className="btn btn-primary"
                disabled={busy === c.id}
                onClick={() => resolve(c.id, true)}
              >
                Approve
              </button>
            </div>
          ) : (
            <span className="tag tag-neutral">{c.status}</span>
          )}
        </div>
      ))}
    </>
  );
}
