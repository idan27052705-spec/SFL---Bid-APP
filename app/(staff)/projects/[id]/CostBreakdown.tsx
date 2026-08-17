"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Printer, Sheet } from "lucide-react";
import { money } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

const cell: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--color-divider)",
};
const headCell: React.CSSProperties = {
  ...cell,
  textAlign: "left",
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  fontWeight: 600,
};
const numCell: React.CSSProperties = { ...cell, textAlign: "right" };

export type Quote = {
  id: string;
  company: string;
  price: number | null;
  declined: boolean;
  awarded: boolean;
};

export type CostTrade = {
  id: string;
  shortId: number;
  trade: string;
  status: string;
  invited: number;
  received: number;
  low: number | null;
  avg: number | null;
  high: number | null;
  awardedPrice: number | null;
  awardedCompany: string | null;
  lowCompany: string | null;
  quotes: Quote[];
};

export type CostTotals = {
  low: number;
  avg: number;
  high: number;
  carried: number;
};

/**
 * The cost breakdown: one collapsible block per trade, its subs inside.
 *
 * Collapsing matters on a real job — fifteen trades with four subs each
 * is sixty rows, and most of the time you want the trade totals and one
 * trade opened up.
 *
 * Sub rows are always rendered and hidden with CSS rather than dropped
 * from the tree, so a printout shows everything no matter which blocks
 * happen to be open on screen.
 */
export default function CostBreakdown({
  projectName,
  trades,
  totals,
}: {
  projectName: string;
  trades: CostTrade[];
  totals: CostTotals;
}) {
  const [closed, setClosed] = useState<string[]>([]);

  const isOpen = (id: string) => !closed.includes(id);
  const toggle = (id: string) =>
    setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const allClosed = closed.length === trades.length && trades.length > 0;
  const toggleAll = () => setClosed(allClosed ? [] : trades.map((t) => t.id));

  const priced = trades.filter((t) => t.received > 0).length;
  const spread = totals.high - totals.low;

  /**
   * Excel opens CSV natively, which beats a real .xlsx here: no library,
   * no version quirks, and the file stays readable if it's ever opened
   * in anything else. Prices are written as bare numbers so Excel can
   * total them; a "$35,000" string would land as text.
   */
  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Project", projectName],
      ["Exported", new Date().toLocaleString("en-US")],
      [],
      [
        "Trade",
        "Subcontractor",
        "Status",
        "Price",
        "Trade low",
        "Trade average",
        "Trade high",
        "Trade spread",
        "Carried",
      ],
    ];

    trades.forEach((t) => {
      const carried = t.awardedPrice ?? t.low;
      rows.push([
        t.trade,
        "",
        t.status,
        "",
        t.low ?? "",
        t.avg ?? "",
        t.high ?? "",
        t.low != null && t.high != null ? t.high - t.low : "",
        carried ?? "",
      ]);
      t.quotes.forEach((q) => {
        rows.push([
          t.trade,
          q.company,
          q.declined ? "Declined" : q.price != null ? "Priced" : "Waiting",
          q.price ?? "",
          "",
          "",
          "",
          "",
          q.awarded ? "Awarded" : "",
        ]);
      });
    });

    rows.push([]);
    rows.push([
      "Project total",
      "",
      "",
      "",
      totals.low,
      totals.avg,
      totals.high,
      spread,
      totals.carried,
    ]);

    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    // The BOM is what makes Excel read accented names correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^\w\s-]/g, "").trim() || "project"} — costs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="printable">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          padding: "0 0 12px",
          flexWrap: "wrap",
        }}
      >
        <h4 style={{ margin: 0 }}>Cost breakdown</h4>
        <span style={{ fontSize: 12, color: MUTED }}>
          {priced} of {trades.length} trades priced · {trades.length - priced} still
          waiting
        </span>

        <div className="noprint" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {trades.length > 0 && (
            <button className="btn btn-ghost" onClick={toggleAll}>
              {allClosed ? "Expand all" : "Collapse all"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Sheet size={15} /> Export to Excel
          </button>
        </div>
      </div>

      <div className="tablewrap" style={{ border: "1px solid var(--color-divider)" }}>
        <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-neutral-200)" }}>
              <th style={headCell}>Trade / subcontractor</th>
              <th style={{ ...headCell, width: 110 }}>Status</th>
              <th style={{ ...headCell, textAlign: "right", width: 120 }}>Price</th>
              <th style={{ ...headCell, textAlign: "right", width: 120 }}>Low</th>
              <th style={{ ...headCell, textAlign: "right", width: 120 }}>Average</th>
              <th style={{ ...headCell, textAlign: "right", width: 120 }}>High</th>
              <th style={{ ...headCell, textAlign: "right", width: 120 }}>Spread</th>
              <th style={{ ...headCell, textAlign: "right", width: 130 }}>Carried</th>
            </tr>
          </thead>

          {trades.length === 0 ? (
            <tbody>
              <tr>
                <td style={cell} colSpan={8}>
                  Nothing priced yet.
                </td>
              </tr>
            </tbody>
          ) : (
            trades.map((t) => {
              const carried = t.awardedPrice ?? t.low;
              const who = t.awardedCompany ?? t.lowCompany;
              const open = isOpen(t.id);

              return (
                <tbody key={t.id} className={open ? undefined : "collapsed"}>
                  <tr style={{ background: "var(--color-neutral-100)" }}>
                    <td style={cell}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          className="btn btn-ghost noprint"
                          onClick={() => toggle(t.id)}
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} the subs on ${t.trade}`}
                          style={{ padding: 2 }}
                        >
                          <ChevronRight
                            size={15}
                            style={{
                              transform: open ? "rotate(90deg)" : "none",
                              transition: "transform .12s ease",
                            }}
                          />
                        </button>
                        <Link
                          className="rowlink"
                          href={`/bids/${t.shortId}`}
                          style={{ fontWeight: 600 }}
                        >
                          {t.trade}
                        </Link>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, paddingLeft: 25 }}>
                        {t.received} of {t.invited} priced
                        {who ? ` · ${t.awardedCompany ? "awarded" : "low"} — ${who}` : ""}
                      </div>
                    </td>
                    <td style={cell}>
                      <span
                        className={t.status === "Awarded" ? "tag tag-accent" : "tag tag-neutral"}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="tabular" style={numCell}>
                      {t.awardedPrice != null ? money(t.awardedPrice) : "—"}
                    </td>
                    <td className="tabular" style={numCell}>
                      {t.low != null ? money(t.low) : "—"}
                    </td>
                    <td className="tabular" style={numCell}>
                      {t.avg != null ? money(t.avg) : "—"}
                    </td>
                    <td className="tabular" style={numCell}>
                      {t.high != null ? money(t.high) : "—"}
                    </td>
                    <td className="tabular" style={numCell}>
                      {t.low != null && t.high != null ? money(t.high - t.low) : "—"}
                    </td>
                    <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                      {carried != null ? money(carried) : "—"}
                    </td>
                  </tr>

                  {t.quotes.length === 0 ? (
                    <tr className="costsub">
                      <td style={{ ...cell, paddingLeft: 36, color: MUTED }} colSpan={8}>
                        Nobody invited to this trade yet.
                      </td>
                    </tr>
                  ) : (
                    t.quotes.map((q) => {
                      const over =
                        q.price != null && t.low != null && q.price > t.low
                          ? q.price - t.low
                          : null;
                      return (
                        <tr key={q.id} className="costsub">
                          <td style={{ ...cell, paddingLeft: 36 }}>
                            {q.company}
                            {q.awarded && (
                              <span className="tag tag-accent" style={{ marginLeft: 8 }}>
                                Awarded
                              </span>
                            )}
                            {!q.awarded && q.price != null && q.price === t.low && (
                              <span className="tag tag-outline" style={{ marginLeft: 8 }}>
                                Low
                              </span>
                            )}
                          </td>
                          <td style={{ ...cell, fontSize: 12, color: MUTED }}>
                            {q.declined ? "Declined" : q.price != null ? "Priced" : "Waiting"}
                          </td>
                          <td
                            className="tabular"
                            style={{
                              ...numCell,
                              fontWeight: q.awarded || q.price === t.low ? 600 : 400,
                            }}
                          >
                            {q.price != null ? money(q.price) : "—"}
                            {over != null && over > 0 && (
                              <div style={{ fontSize: 11, color: MUTED }}>
                                +{money(over)} over low
                              </div>
                            )}
                          </td>
                          {/* The spread columns describe the trade, not one
                              sub — left empty on purpose. */}
                          <td style={cell} />
                          <td style={cell} />
                          <td style={cell} />
                          <td style={cell} />
                          <td style={cell} />
                        </tr>
                      );
                    })
                  )}
                </tbody>
              );
            })
          )}

          <tfoot>
            <tr style={{ background: "var(--color-neutral-200)" }}>
              <td style={{ ...cell, fontWeight: 600 }} colSpan={3}>
                Project total
              </td>
              <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                {money(totals.low)}
              </td>
              <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                {money(totals.avg)}
              </td>
              <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                {money(totals.high)}
              </td>
              <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                {money(spread)}
              </td>
              <td className="tabular" style={{ ...numCell, fontWeight: 600 }}>
                {money(totals.carried)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
