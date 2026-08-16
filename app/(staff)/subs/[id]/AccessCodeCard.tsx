"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { timeAgo } from "@/lib/format";

export default function AccessCodeCard({
  shortId,
  companyName,
  issuedAt,
  hasCode,
  code: storedCode,
  canWrite,
}: {
  shortId: number;
  companyName: string;
  issuedAt: string | null;
  hasCode: boolean;
  code: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState<string | null>(null);
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
    setCode(data.code);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="card-kicker">Portal access</div>

      <div style={{ fontSize: 14 }}>
        {storedCode ? (
          <>
            <div
              className="mono"
              style={{ fontSize: 30, letterSpacing: ".16em", lineHeight: 1.1 }}
            >
              {storedCode}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Issued {issuedAt ? timeAgo(issuedAt) : "—"} · goes out in every
              invitation and reminder
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: 0, fontSize: 12, marginTop: 4 }}
              onClick={() => navigator.clipboard?.writeText(storedCode)}
            >
              Copy code
            </button>
          </>
        ) : hasCode ? (
          <div className="text-muted">
            This code was issued before codes could be shown. Issue a new one to
            see it.
          </div>
        ) : (
          <div className="text-muted">No code issued yet.</div>
        )}
      </div>

      {error && <div style={{ fontSize: 13, color: "#b3261e" }}>{error}</div>}

      {canWrite && (
        <button className="btn btn-secondary" onClick={() => setConfirming(true)}>
          {hasCode ? "Issue a new code" : "Issue a code"}
        </button>
      )}

      {confirming && (
        <Modal
          title="Issue a new access code?"
          subtitle={companyName}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={regenerate} disabled={busy}>
                {busy ? "Issuing…" : "Issue new code"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            Their old code stops working right away, and if they&apos;re signed
            into the portal they get signed out.
          </p>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Use this if a code was shared with the wrong person, or someone left
            the company.
          </p>
        </Modal>
      )}

      {code && (
        <Modal
          title="New access code"
          subtitle={`${companyName} signs in with their email and this code.`}
          onClose={() => setCode(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setCode(null)}>
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
            {code}
          </div>
          <p style={{ fontSize: 13, margin: 0 }}>
            <strong>Write this down or text it now.</strong> You won&apos;t be
            able to see it again.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard?.writeText(code)}
          >
            Copy code
          </button>
        </Modal>
      )}
    </div>
  );
}
