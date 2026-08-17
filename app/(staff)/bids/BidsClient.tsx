"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import { BID_STATUSES } from "@/app/config";
import { formatDateShort, money } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export type BidRow = {
  id: string;
  short_id: number;
  project: string;
  trade: string;
  invited: number;
  viewed: number;
  received: number;
  low: number | null;
  due_date: string | null;
  cadence: string;
  status: string;
};

/** "All" leaves out finished packages — you have to ask for those. */
const FILTERS = ["All", ...BID_STATUSES];
const DONE = ["Awarded", "Closed"];

export default function BidsClient({
  bids,
  canWrite,
}: {
  bids: BidRow[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return bids.filter((b) => {
      if (status === "All" ? DONE.includes(b.status) : b.status !== status)
        return false;
      if (!s) return true;
      return [b.project, b.trade, b.status].join(" ").toLowerCase().includes(s);
    });
  }, [bids, search, status]);

  const live = bids.filter((b) => !DONE.includes(b.status)).length;

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h6 className="text-muted">Bids</h6>
            <h1 style={{ marginBottom: 0 }}>
              {live} bid{live === 1 ? "" : "s"} in play
            </h1>
          </div>
        </div>
      </div>

      <div className="pagebody">
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search projects, trades, statuses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="seg" style={{ display: "inline-flex" }}>
            {FILTERS.map((s) => (
              <button
                key={s}
                className="btn"
                onClick={() => setStatus(s)}
                style={{
                  border: 0,
                  borderLeft: s === FILTERS[0] ? 0 : "1px solid var(--color-divider)",
                  background:
                    status === s
                      ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                      : "transparent",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 28, alignItems: "flex-start" }}>
            <div className="card-title">
              {bids.length === 0 ? "No bid packages yet" : "Nothing matches that"}
            </div>
            <p className="card-body">
              {bids.length === 0
                ? "Open a project and create a bid package inside it, then send it to your subs."
                : "Try a different search or status filter."}
            </p>
            {bids.length === 0 && canWrite && (
              <Link className="btn btn-primary" href="/projects">
                Go to projects
              </Link>
            )}
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project / trade</th>
                  <th>Invited</th>
                  <th>Viewed</th>
                  <th>Received</th>
                  <th>Low bid</th>
                  <th>Due</th>
                  <th>Cadence</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link className="rowlink" href={`/bids/${b.short_id}`}>
                        <strong>{b.project}</strong>
                      </Link>
                      <div style={{ fontSize: 12, color: MUTED }}>{b.trade}</div>
                    </td>
                    <td>{b.invited}</td>
                    <td>{b.viewed}</td>
                    <td>{b.received}</td>
                    <td className="tabular">{b.low != null ? money(b.low) : "—"}</td>
                    <td>{formatDateShort(b.due_date)}</td>
                    <td>{b.cadence}</td>
                    <td>
                      <span
                        className={
                          b.status === "Awarded"
                            ? "tag tag-accent"
                            : b.status === "Out for Bid" || b.status === "Responses In"
                              ? "tag tag-outline"
                              : "tag tag-neutral"
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {/* An awarded package is history — the bid page hides
                          Edit on the same rule. */}
                      {canWrite && b.status !== "Awarded" && (
                        <Link
                          className="btn btn-ghost"
                          href={`/bids/${b.short_id}/edit`}
                          style={{ marginRight: 6 }}
                        >
                          <Pencil size={14} /> Edit bid
                        </Link>
                      )}
                      <Link className="btn btn-secondary" href={`/bids/${b.short_id}`}>
                        View bid <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
