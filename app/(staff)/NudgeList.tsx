"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export type Nudge = {
  invitationId: string;
  company: string;
  context: string;
  state: string;
  daysSinceSent: number;
};

const FILTERS: [string, number][] = [
  ["All", 0],
  ["2 days", 2],
  ["5 days", 5],
  ["10 days", 10],
  ["30 days", 30],
];

/**
 * "Needs a nudge" — the list the office works from.
 * The age filter narrows to people who've been quiet that long, and the
 * bulk button chases everyone currently in the window.
 */
export default function NudgeList({ nudges }: { nudges: Nudge[] }) {
  const router = useRouter();
  const [age, setAge] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const pool = useMemo(
    () => nudges.filter((n) => n.daysSinceSent >= age),
    [nudges, age]
  );
  const shown = pool.slice(0, 6);

  async function nudgeOne(n: Nudge) {
    setBusy(n.invitationId);
    setMessage(null);
    const res = await fetch(`/api/invitations/${n.invitationId}/resend`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(`${n.company}: ${data.error || "couldn't send"}`);
      return;
    }
    setDone((d) => [...d, n.invitationId]);
    router.refresh();
  }

  async function nudgeAll() {
    if (pool.length === 0) {
      setMessage("Nobody matches that window right now.");
      return;
    }
    setBusy("all");
    setMessage(null);
    const res = await fetch("/api/invitations/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: age }),
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      setMessage(data.error || "Couldn't send.");
      return;
    }
    setMessage(
      `Reminder sent to ${data.sent} sub${data.sent === 1 ? "" : "s"}.` +
        (data.failed?.length ? ` Couldn't reach: ${data.failed.join(", ")}.` : "") +
        " They drop off this list until the window passes again."
    );
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>Needs a nudge</h4>
        <span style={{ fontSize: 12, color: MUTED }}>
          {age === 0 ? "Everyone still open" : `Not contacted in ${age}+ days`} ·{" "}
          {pool.length} open
        </span>
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={nudgeAll}
          disabled={busy === "all"}
        >
          <Send size={15} />
          {busy === "all" ? "Sending…" : `Send again to all ${pool.length}`}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {FILTERS.map(([label, value]) => (
          <button
            key={label}
            className="btn btn-secondary"
            style={{
              fontSize: 12,
              padding: "4px 10px",
              background:
                age === value
                  ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                  : "transparent",
            }}
            onClick={() => setAge(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ fontSize: 13, color: MUTED, paddingBottom: 10 }}>{message}</div>
      )}

      {pool.length === 0 ? (
        <div style={{ fontSize: 13, color: MUTED, padding: "8px 0 14px" }}>
          Everyone in this window has been contacted. Widen it to see more.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          {shown.map((n) => (
            <div
              key={n.invitationId}
              className="blueprint"
              style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.company}
                </div>
                <div style={{ fontSize: 12, color: MUTED }}>{n.context}</div>
                <div style={{ fontSize: 11, marginTop: 6, color: "var(--color-accent-700)" }}>
                  {n.state}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: "4px 9px" }}
                disabled={busy === n.invitationId || done.includes(n.invitationId)}
                onClick={() => nudgeOne(n)}
              >
                {done.includes(n.invitationId) ? "Sent" : "Send again"}
              </button>
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
            </div>
          ))}
        </div>
      )}

      {pool.length > shown.length && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          Showing 6 of {pool.length}. Use “Send again to all” to chase the rest.
        </div>
      )}
    </>
  );
}
