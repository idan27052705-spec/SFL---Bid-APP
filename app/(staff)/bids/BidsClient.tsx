"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";

export type BidRow = {
  id: string;
  short_id: number;
  title: string;
  status: string;
  due_date: string | null;
  trade: string;
  project: string;
  projectShortId: number;
  invited: number;
  received: number;
};

const STATUSES = ["All", "Draft", "Out for Bid", "Responses In", "Awarded"];

export default function BidsClient({ bids }: { bids: BidRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return bids.filter((b) => {
      if (status !== "All" && b.status !== status) return false;
      if (!s) return true;
      return [b.project, b.trade, b.title]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [bids, search, status]);

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">Bids</h6>
        <h1 style={{ marginBottom: 0 }}>
          {bids.length} bid package{bids.length === 1 ? "" : "s"}
        </h1>
      </div>

      <div className="pagebody">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search project, trade, package…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="seg" style={{ display: "inline-flex" }}>
            {STATUSES.map((s, n) => (
              <button
                key={s}
                className="btn"
                onClick={() => setStatus(s)}
                style={{
                  border: 0,
                  borderLeft: n === 0 ? 0 : "1px solid var(--color-divider)",
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
                ? "Open a project and create a bid package — one per trade."
                : "Try a different search or status filter."}
            </p>
            {bids.length === 0 && <Link className="btn btn-primary" href="/projects">Go to projects</Link>}
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Project</th>
                  <th>Package</th>
                  <th>Due</th>
                  <th>Responses</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link className="rowlink" href={`/bids/${b.short_id}`}>
                        <strong>{b.trade}</strong>
                      </Link>
                    </td>
                    <td>
                      <Link className="rowlink" href={`/projects/${b.projectShortId}`}>
                        {b.project}
                      </Link>
                    </td>
                    <td>{b.title}</td>
                    <td>{formatDate(b.due_date)}</td>
                    <td>
                      {b.invited === 0 ? (
                        <span className="text-muted">not sent</span>
                      ) : (
                        `${b.received} of ${b.invited}`
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          b.status === "Awarded"
                            ? "tag tag-accent"
                            : b.status === "Draft"
                              ? "tag tag-neutral"
                              : "tag tag-outline"
                        }
                      >
                        {b.status}
                      </span>
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
