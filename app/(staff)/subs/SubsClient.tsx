"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import Blueprint from "@/components/Blueprint";
import SubModal, { type Trade, type EditableSub } from "./SubModal";
import FilterMenu from "@/components/FilterMenu";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";

export type SubRow = {
  id: string;
  short_id: number;
  company: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  trades: string[];
  tradeIds: string[];
  invited: number;
  responded: number;
  code: string | null;
  status: string;
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
  const [tradeFilter, setTradeFilter] = useState<string[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<EditableSub | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return subs.filter((x) => {
      // No trades ticked means no trade filter at all.
      if (tradeFilter.length && !x.trades.some((t) => tradeFilter.includes(t)))
        return false;
      if (!s) return true;
      return [x.company, x.contact, x.city, x.trades.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [subs, search, tradeFilter]);

  return (
    <>
      <header
        className="pagehead"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Subcontractors</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            {subs.length} compan{subs.length === 1 ? "y" : "ies"}
          </div>
        </div>
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Search subs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canWrite && (
          <button className="btn btn-primary blueprint" onClick={() => setModal(true)}>
            <Plus size={15} /> Add sub
            <i className="corner tl" /><i className="corner tr" />
            <i className="corner bl" /><i className="corner br" />
          </button>
        )}
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <FilterMenu
            label="Trades"
            title="Filter by trade"
            options={trades.map((t) => ({ id: t.name, label: t.name }))}
            selected={tradeFilter}
            onChange={setTradeFilter}
          />

          <span style={{ fontSize: 12, color: MUTED }}>
            {rows.length} of {subs.length} shown
          </span>
        </div>

        <Blueprint style={{ padding: "12px 18px 6px" }}>
          <div className="tablewrap">
            <table className="table" style={{ minWidth: 940 }}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Trades</th>
                  <th>Invited</th>
                  <th>Response rate</th>
                  <th>Access code</th>
                  <th>Status</th>
                  {canWrite && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 8 : 7} style={{ color: MUTED }}>
                      {subs.length === 0
                        ? "No subs yet. Add the ones you actually bid with."
                        : "Nothing matches that."}
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => (
                    <tr key={s.id} className="clickrow">
                      <td>
                        <Link className="rowlink" href={`/subs/${s.short_id}`} style={{ fontWeight: 500 }}>
                          {s.company}
                        </Link>
                        <div style={{ fontSize: 12, color: MUTED }}>{s.city}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {s.contact || "—"}
                        <div style={{ fontSize: 11, color: FAINT }}>{s.phone}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{s.trades.join(", ") || "—"}</td>
                      <td style={{ fontSize: 13 }}>{s.invited}</td>
                      <td style={{ fontSize: 13 }}>
                        {s.invited === 0
                          ? "—"
                          : `${Math.round((s.responded / s.invited) * 100)}% · ${s.responded} of ${s.invited}`}
                      </td>
                      <td className="mono" style={{ fontSize: 13, letterSpacing: ".08em" }}>
                        {s.code ?? "—"}
                      </td>
                      <td>
                        <span className={s.status === "Active" ? "tag tag-accent" : "tag tag-neutral"}>
                          {s.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              setEditing({
                                shortId: s.short_id,
                                companyName: s.company,
                                contactName: s.contact,
                                email: s.email,
                                phone: s.phone,
                                city: s.city,
                                status: s.status,
                                tradeIds: s.tradeIds,
                              })
                            }
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Blueprint>
      </div>

      {modal && <SubModal trades={trades} onClose={() => setModal(false)} />}
      {editing && (
        <SubModal trades={trades} sub={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
