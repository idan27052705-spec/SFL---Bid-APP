"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

export type InviteSub = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  city: string | null;
  trades: string[];
  alreadyInvited: boolean;
};

export default function InviteClient({
  bidShortId,
  tradeName,
  projectName,
  subs,
}: {
  bidShortId: number;
  tradeName: string;
  projectName: string;
  subs: InviteSub[];
}) {
  const router = useRouter();
  const [onlyTrade, setOnlyTrade] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sent: string[];
    failed: { company: string; reason: string }[];
    issuedCodes: { company: string; code: string }[];
  } | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return subs.filter((x) => {
      if (onlyTrade && !x.trades.includes(tradeName)) return false;
      if (!s) return true;
      return [x.company_name, x.contact_name, x.city, x.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [subs, search, onlyTrade, tradeName]);

  const selectable = rows.filter((r) => !r.alreadyInvited && r.email);
  const allPicked =
    selectable.length > 0 && selectable.every((r) => picked.includes(r.id));

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function send() {
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
      <div className="pagehead">
        <h6 className="text-muted">
          <Link className="rowlink" href={`/bids/${bidShortId}`}>
            {projectName} · {tradeName}
          </Link>
        </h6>
        <h1 style={{ marginBottom: 4 }}>Invite subs</h1>
        <p className="text-muted" style={{ maxWidth: 620 }}>
          Each sub gets an email with the scope, the due date and a link
          straight into their portal. No password to remember.
        </p>
      </div>

      <div className="pagebody" style={{ maxWidth: 860 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Search subs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              className="chk"
              checked={onlyTrade}
              onChange={(e) => setOnlyTrade(e.target.checked)}
            />
            Only show {tradeName} subs
          </label>
          {selectable.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() =>
                setPicked(allPicked ? [] : selectable.map((r) => r.id))
              }
            >
              {allPicked ? "Clear all" : `Select all ${selectable.length}`}
            </button>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 12 }} role="alert">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 26, alignItems: "flex-start" }}>
            <div className="card-title">No subs to show</div>
            <p className="card-body">
              {onlyTrade
                ? `Nobody in your list does ${tradeName}. Untick the filter to see everyone, or add a sub.`
                : "Add subs first, then come back and invite them."}
            </p>
            <Link className="btn btn-secondary" href="/subs">
              Go to subs
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Trades</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const disabled = s.alreadyInvited || !s.email;
                  return (
                    <tr key={s.id} style={disabled ? { opacity: 0.55 } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className="chk"
                          checked={picked.includes(s.id)}
                          disabled={disabled}
                          onChange={() => toggle(s.id)}
                        />
                      </td>
                      <td>
                        <strong>{s.company_name}</strong>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {s.email || "no email on file"}
                          {s.alreadyInvited && " · already invited"}
                        </div>
                      </td>
                      <td>{s.contact_name || "—"}</td>
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {s.trades.map((t) => (
                            <span key={t} className="tag tag-neutral">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{s.city || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={send}
            disabled={busy || picked.length === 0}
          >
            {busy
              ? "Sending…"
              : picked.length === 0
                ? "Send invitations"
                : `Send ${picked.length} invitation${picked.length === 1 ? "" : "s"}`}
          </button>
          <Link className="btn btn-secondary" href={`/bids/${bidShortId}`}>
            Back to the package
          </Link>
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
            router.push(`/bids/${bidShortId}`);
          }}
          width={520}
          footer={
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                router.push(`/bids/${bidShortId}`);
              }}
            >
              Done
            </button>
          }
        >
          {result.sent.length > 0 && (
            <div style={{ fontSize: 14 }}>
              Emailed: {result.sent.join(", ")}
            </div>
          )}

          {result.issuedCodes.length > 0 && (
            <div
              className="card"
              style={{ borderColor: "var(--color-accent)", gap: 8 }}
            >
              <div className="card-kicker">New access codes issued</div>
              <div style={{ fontSize: 13 }}>
                These subs had no code yet. The code is in their email — write it
                down too, in case they call the office.
              </div>
              {result.issuedCodes.map((c) => (
                <div
                  key={c.company}
                  style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}
                >
                  <span style={{ flex: 1 }}>{c.company}</span>
                  <span className="mono" style={{ fontSize: 18, letterSpacing: ".12em" }}>
                    {c.code}
                  </span>
                </div>
              ))}
            </div>
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
