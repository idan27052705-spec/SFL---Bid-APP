"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Blueprint from "@/components/Blueprint";
import { ArrowRight } from "lucide-react";
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

export default function BidsClient({ bids }: { bids: BidRow[] }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return bids;
    return bids.filter((b) =>
      [b.project, b.trade, b.status].join(" ").toLowerCase().includes(s)
    );
  }, [bids, search]);

  return (
    <>
      <header
        className="pagehead"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Bids</h1>
          <div style={{ fontSize: 13, color: MUTED }}>Every bid across every project</div>
        </div>
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Search bids"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        <Blueprint style={{ padding: "12px 18px 6px" }}>
          <div className="tablewrap">
            <table className="table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>Project / trade</th>
                  <th>Invited</th>
                  <th>Viewed</th>
                  <th>Received</th>
                  <th>Low bid</th>
                  <th>Due</th>
                  <th>Reminders</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ color: MUTED }}>
                      {bids.length === 0
                        ? "No bid packages yet. Open a project and create one."
                        : "Nothing matches that search."}
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.id} className="clickrow">
                      <td>
                        <Link className="rowlink" href={`/bids/${b.short_id}`} style={{ fontWeight: 500 }}>
                          {b.project}
                        </Link>
                        <div style={{ fontSize: 12, color: MUTED }}>{b.trade}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{b.invited}</td>
                      <td style={{ fontSize: 13 }}>{b.viewed}</td>
                      <td style={{ fontSize: 13 }}>{b.received}</td>
                      <td className="tabular" style={{ fontSize: 13 }}>
                        {b.low != null ? money(b.low) : "—"}
                      </td>
                      <td style={{ fontSize: 13 }}>{formatDateShort(b.due_date)}</td>
                      <td style={{ fontSize: 13 }}>{b.cadence}</td>
                      <td>
                        <span className="tag tag-accent">{b.status}</span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link className="btn btn-secondary" href={`/bids/${b.short_id}`}>
                          View bid <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Blueprint>
      </div>
    </>
  );
}
