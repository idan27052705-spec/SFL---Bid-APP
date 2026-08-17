"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Blueprint from "@/components/Blueprint";
import Modal, { ModalField } from "@/components/Modal";
import { money, timeAgo } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export type Quote = {
  invitationId: string;
  subId: string;
  company: string;
  price: number;
  rank: string;
  leadTime: string | null;
  exclusions: string | null;
  notes: string | null;
  submittedAt: string | null;
  fileId: string | null;
  awarded: boolean;
};

/**
 * Compare is a matrix: one column per sub, one row per thing you'd want
 * to line up. Reading across a row is the whole point — you can see at a
 * glance who's excluding what.
 */
export default function CompareClient({
  bidShortId,
  quotes,
  canWrite,
  awarded,
}: {
  bidShortId: number;
  quotes: Quote[];
  canWrite: boolean;
  awarded: boolean;
}) {
  const router = useRouter();
  const [awarding, setAwarding] = useState<Quote | null>(null);
  const [denying, setDenying] = useState<Quote | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const rows: [string, (q: Quote) => string][] = [
    ["Total price", (q) => money(q.price)],
    ["vs. low bid", (q) => q.rank],
    ["Lead time", (q) => q.leadTime || "—"],
    ["Exclusions", (q) => q.exclusions || "None stated"],
    ["Notes", (q) => q.notes || "—"],
    ["Submitted", (q) => (q.submittedAt ? timeAgo(q.submittedAt) : "—")],
  ];

  async function openFile(id: string) {
    const res = await fetch(`/api/files/${id}`);
    const data = await res.json();
    if (res.ok) window.open(data.url, "_blank", "noopener");
    else setError(data.error || "Couldn't open that file.");
  }

  async function award() {
    if (!awarding) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bids/${bidShortId}/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subId: awarding.subId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Couldn't award.");
      return;
    }
    setAwarding(null);
    setBanner(
      data.emailed
        ? `${data.company} has been awarded and emailed.`
        : `${data.company} has been awarded. The email didn't go out — give them a call.`
    );
    router.refresh();
  }

  async function deny() {
    if (!denying || !reason.trim()) {
      setError("Give a reason.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/invitations/${denying.invitationId}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save.");
      return;
    }
    setDenying(null);
    setReason("");
    router.refresh();
  }

  if (quotes.length === 0)
    return (
      <Blueprint style={{ padding: 26 }}>
        <div className="card-title">No prices yet</div>
        <p style={{ fontSize: 14, color: MUTED, margin: "6px 0 0" }}>
          Nothing to compare until a sub sends a price. They appear here the
          moment they do.
        </p>
      </Blueprint>
    );

  return (
    <>
      {banner && (
        <Blueprint
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderColor: "var(--color-accent)",
            background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
            fontSize: 14,
          }}
        >
          {banner}
        </Blueprint>
      )}
      {error && (
        <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 12 }} role="alert">
          {error}
        </div>
      )}

      <Blueprint style={{ padding: "12px 18px 6px" }}>
        <div className="tablewrap">
          {/* Width follows the number of subs rather than a fixed 720px, so
              on a phone you see the pinned label plus a full column instead
              of two half-columns. */}
          <table
            className="table table-pinned"
            style={{ minWidth: Math.max(420, 150 + quotes.length * 185) }}
          >
            <thead>
              <tr>
                <th>Line</th>
                {quotes.map((q) => (
                  <th key={q.invitationId} style={{ textAlign: "right" }}>
                    {q.company}
                    {q.awarded && (
                      <div>
                        <span className="tag tag-accent">Awarded</span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([labelText, pick]) => (
                <tr key={labelText}>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{labelText}</td>
                  {quotes.map((q) => (
                    <td
                      key={q.invitationId}
                      className="tabular"
                      style={{
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: labelText === "Total price" ? 600 : 400,
                      }}
                    >
                      {pick(q)}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <td style={{ fontSize: 13, fontWeight: 500 }}>Their quote</td>
                {quotes.map((q) => (
                  <td key={q.invitationId} style={{ textAlign: "right" }}>
                    {q.fileId ? (
                      <button className="btn btn-ghost" onClick={() => openFile(q.fileId!)}>
                        Open
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, color: MUTED }}>—</span>
                    )}
                  </td>
                ))}
              </tr>

              {canWrite && !awarded && (
                <tr>
                  <td />
                  {quotes.map((q) => (
                    <td key={q.invitationId} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setDenying(q);
                          setReason("");
                        }}
                      >
                        Deny
                      </button>
                      <button className="btn btn-primary" onClick={() => setAwarding(q)}>
                        Award
                      </button>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Blueprint>

      {awarding && (
        <Modal
          title={`Award to ${awarding.company}?`}
          subtitle={money(awarding.price)}
          onClose={() => setAwarding(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAwarding(null)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={award} disabled={busy}>
                {busy ? "Awarding…" : "Award it"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            {awarding.company} gets an email telling them they won. Every reminder
            on this package stops, for everyone.
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            The package locks after this — the scope they priced can&apos;t be
            edited afterwards. Nothing is sent to the subs who didn&apos;t win.
          </p>
        </Modal>
      )}

      {denying && (
        <Modal
          title={`Rule out ${denying.company}?`}
          subtitle="They aren't told. This is for your record."
          onClose={() => setDenying(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDenying(null)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={deny} disabled={busy}>
                {busy ? "Saving…" : "Rule out"}
              </button>
            </>
          }
        >
          <ModalField
            id="reason"
            label="Why?"
            required
            value={reason}
            onChange={setReason}
            textarea
            placeholder="Scope gaps, lead time too long, wrong trade…"
          />
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Their price stays on the record with this reason next to it, and
            reminders stop.
          </p>
        </Modal>
      )}
    </>
  );
}
