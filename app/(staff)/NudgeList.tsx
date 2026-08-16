"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";

export type Nudge = {
  invitationId: string;
  company: string;
  trade: string;
  project: string;
  bidShortId: number;
  sentAt: string | null;
  viewedAt: string | null;
  reminders: number;
};

/**
 * The list the office actually works from: who was sent a package and
 * has gone quiet. One button per row, because chasing should take one
 * click, not five.
 */
export default function NudgeList({ nudges }: { nudges: Nudge[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function nudge(n: Nudge) {
    setBusy(n.invitationId);
    setError(null);
    const res = await fetch(`/api/invitations/${n.invitationId}/resend`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      setError(`${n.company}: ${data.error || "couldn't send"}`);
      return;
    }
    setDone((d) => [...d, n.invitationId]);
    router.refresh();
  }

  if (nudges.length === 0)
    return (
      <p className="text-muted" style={{ fontSize: 14 }}>
        Nobody is overdue. Everyone who was sent a package has either opened it
        or priced it.
      </p>
    );

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error && <div style={{ fontSize: 13, color: "#b3261e" }}>{error}</div>}

      {nudges.map((n) => (
        <div
          key={n.invitationId}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "8px 0",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14 }}>
              <strong>{n.company}</strong>
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              <Link className="rowlink" href={`/bids/${n.bidShortId}`}>
                {n.trade} · {n.project}
              </Link>
            </div>
          </div>

          <div className="text-muted" style={{ fontSize: 12, minWidth: 120 }}>
            {n.viewedAt
              ? `opened ${timeAgo(n.viewedAt)}, no price`
              : `never opened · sent ${timeAgo(n.sentAt)}`}
            {n.reminders > 0 && ` · ${n.reminders} reminder${n.reminders === 1 ? "" : "s"}`}
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => nudge(n)}
            disabled={busy === n.invitationId || done.includes(n.invitationId)}
          >
            {done.includes(n.invitationId)
              ? "Sent"
              : busy === n.invitationId
                ? "Sending…"
                : "Nudge"}
          </button>
        </div>
      ))}
    </div>
  );
}
