"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NewSubModal, { type Trade } from "./NewSubModal";

export type SubRow = {
  id: string;
  short_id: number;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  trades: string[];
};

export default function SubsClient({
  subs,
  trades,
  canWrite,
}: {
  subs: SubRow[];
  trades: Trade[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("All trades");
  const [modal, setModal] = useState(false);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return subs.filter((x) => {
      if (trade !== "All trades" && !x.trades.includes(trade)) return false;
      if (!s) return true;
      return [x.company_name, x.contact_name, x.email, x.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [subs, search, trade]);

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h6 className="text-muted">Subs</h6>
            <h1 style={{ marginBottom: 0 }}>
              {subs.length} subcontractor{subs.length === 1 ? "" : "s"}
            </h1>
          </div>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              Add sub
            </button>
          )}
        </div>
      </div>

      <div className="pagebody">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search company, contact, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 220 }}
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            <option>All trades</option>
            {trades.map((t) => (
              <option key={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 28, alignItems: "flex-start" }}>
            <div className="card-title">
              {subs.length === 0 ? "No subs yet" : "Nothing matches that"}
            </div>
            <p className="card-body">
              {subs.length === 0
                ? "Add the subs you actually bid with. Each one gets a 6-digit access code for the portal."
                : "Try a different search or trade filter."}
            </p>
            {subs.length === 0 && canWrite && (
              <button className="btn btn-primary" onClick={() => setModal(true)}>
                Add sub
              </button>
            )}
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Trades</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="rowlink" href={`/subs/${s.short_id}`}>
                        <strong>{s.company_name}</strong>
                      </Link>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {s.email}
                      </div>
                    </td>
                    <td>{s.contact_name || "—"}</td>
                    <td style={{ maxWidth: 240 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.trades.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          s.trades.map((t) => (
                            <span key={t} className="tag tag-neutral">
                              {t}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>{s.city || "—"}</td>
                    <td>{s.phone || "—"}</td>
                    <td>
                      <span
                        className={
                          s.status === "Active" ? "tag tag-accent" : "tag tag-neutral"
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <NewSubModal trades={trades} onClose={() => setModal(false)} />}
    </>
  );
}
