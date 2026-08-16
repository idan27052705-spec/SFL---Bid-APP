"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal, { ModalField } from "@/components/Modal";
import { money, formatDate, timeAgo } from "@/lib/format";

export type Quote = {
  invitationId: string;
  subId: string;
  company: string;
  contact: string | null;
  status: string;
  price: number | null;
  leadTime: string | null;
  exclusions: string | null;
  notes: string | null;
  submittedAt: string | null;
  fileId: string | null;
  fileName: string | null;
  declineReason: string | null;
  viewedAt: string | null;
  sentAt: string | null;
};

export default function CompareClient({
  bidShortId,
  tradeName,
  projectName,
  projectShortId,
  dueDate,
  awardedSubId,
  quotes,
  canWrite,
}: {
  bidShortId: number;
  tradeName: string;
  projectName: string;
  projectShortId: number;
  dueDate: string | null;
  awardedSubId: string | null;
  quotes: Quote[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [awarding, setAwarding] = useState<Quote | null>(null);
  const [denying, setDenying] = useState<Quote | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const priced = quotes
    .filter((q) => q.price != null && q.status !== "Denied")
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const others = quotes.filter((q) => q.price == null || q.status === "Denied");

  const low = priced.length > 0 ? priced[0].price : null;
  const high = priced.length > 0 ? priced[priced.length - 1].price : null;
  const spread = low != null && high != null ? high - low : null;

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
    if (!denying) return;
    if (!reason.trim()) {
      setError("Give a reason.");
      return;
    }
    setBusy(true);
    setError(null);
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

  const awarded = !!awardedSubId;

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">
          <Link className="rowlink" href={`/projects/${projectShortId}`}>
            {projectName}
          </Link>
        </h6>
        <h1 style={{ marginBottom: 4 }}>Compare — {tradeName}</h1>
        <p className="text-muted">
          {priced.length} price{priced.length === 1 ? "" : "s"} in
          {dueDate ? ` · due ${formatDate(dueDate)}` : ""}
          {spread != null && spread > 0
            ? ` · ${money(spread)} between low and high`
            : ""}
        </p>
      </div>

      <div className="pagebody">
        {banner && (
          <div
            className="card"
            style={{
              borderColor: "var(--color-accent)",
              background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
              marginBottom: 16,
            }}
          >
            {banner}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 12 }} role="alert">
            {error}
          </div>
        )}

        {priced.length === 0 ? (
          <div className="card" style={{ padding: 26, alignItems: "flex-start" }}>
            <div className="card-title">No prices yet</div>
            <p className="card-body">
              Nothing to compare until a sub sends a price. They show up here the
              moment they do.
            </p>
            <Link className="btn btn-secondary" href={`/bids/${bidShortId}`}>
              Back to the package
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {priced.map((q, i) => {
              const isLow = q.price === low;
              const won = q.subId === awardedSubId;
              const overLow = low != null && q.price != null ? q.price - low : 0;

              return (
                <div
                  key={q.invitationId}
                  className="card"
                  style={{
                    gap: 10,
                    borderColor: won
                      ? "var(--color-accent)"
                      : isLow
                        ? "var(--color-accent)"
                        : "var(--color-divider)",
                    background: won
                      ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                      : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="card-title">{q.company}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {q.contact}
                        {q.submittedAt ? ` · sent ${timeAgo(q.submittedAt)}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: 28,
                          lineHeight: 1,
                        }}
                      >
                        {money(q.price)}
                      </div>
                      {i > 0 && overLow > 0 && (
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          +{money(overLow)} over low
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {won && <span className="tag tag-accent">Awarded</span>}
                    {isLow && !won && <span className="tag tag-outline">Low bid</span>}
                    {q.leadTime && (
                      <span className="tag tag-neutral">Lead time: {q.leadTime}</span>
                    )}
                  </div>

                  {q.exclusions && (
                    <div style={{ fontSize: 14 }}>
                      <strong>Not included:</strong> {q.exclusions}
                    </div>
                  )}
                  {q.notes && (
                    <div style={{ fontSize: 14 }} className="text-muted">
                      {q.notes}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.fileId && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => openFile(q.fileId!)}
                      >
                        Open their quote
                      </button>
                    )}
                    {canWrite && !awarded && (
                      <>
                        <button className="btn btn-primary" onClick={() => setAwarding(q)}>
                          Award to {q.company.split(" ")[0]}
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            setDenying(q);
                            setReason("");
                          }}
                        >
                          Rule out
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {others.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h5>Everyone else</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Sub</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {others.map((q) => (
                  <tr key={q.invitationId}>
                    <td>{q.company}</td>
                    <td>
                      <span className="tag tag-neutral">{q.status}</span>
                    </td>
                    <td className="text-muted">
                      {q.viewedAt ? timeAgo(q.viewedAt) : "never opened"}
                    </td>
                    <td className="text-muted">{q.declineReason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {awarding && (
        <Modal
          title={`Award ${tradeName} to ${awarding.company}?`}
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
            {awarding.company} gets an email telling them they won. Every
            reminder on this package stops, for everyone.
          </p>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
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
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Their price stays on the record with this reason next to it, and
            reminders stop.
          </p>
        </Modal>
      )}
    </>
  );
}
