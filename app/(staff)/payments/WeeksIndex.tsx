"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Wallet } from "lucide-react";
import Blueprint from "@/components/Blueprint";
import { money } from "@/lib/format";
import {
  addWeeks,
  deadlineLabel,
  defaultWeekStart,
  relativeWeekLabel,
  weekLabel,
  weekOffset,
} from "@/lib/weeks";
import { MUTED, cell, headCell, numCell } from "./sheet";
import { usePayments } from "./PaymentsProvider";
import { isWeekSubmitted, paymentState } from "@/lib/payments";

/** Two weeks ahead is enough to get a jump on a holiday week. */
const AHEAD = 2;
/** A quarter of history even when the system is brand new and empty. */
const MIN_BACK = 13;

/** The sticky header keeps its border — a collapsed one drops when it sticks. */
const stickyHead: React.CSSProperties = {
  ...headCell,
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "var(--color-bg)",
  boxShadow: "inset 0 0 0 1px var(--color-divider)",
};

/**
 * The landing screen: one row per week, newest first.
 *
 * The week you are meant to be filling is marked, so opening the page on
 * a Thursday puts the thing you owe at eye level rather than making you
 * work out which week "next week" is.
 *
 * The list grows backwards as weeks are filled in — it always reaches at
 * least a quarter back, and further if there are payments older than
 * that — so it scrolls inside its own box rather than pushing the page
 * longer and longer as the years go by.
 */
export default function WeeksIndex() {
  const { rows, submissions, pms, isFinance } = usePayments();
  const router = useRouter();

  const current = defaultWeekStart();

  /** Submitted, not yet paid or sent back — the finance queue's size. */
  const waiting = rows.filter(
    (r) =>
      paymentState(r, isWeekSubmitted(submissions, r.pmId, r.weekStart)) === "Pending"
  ).length;

  const earliest = rows.reduce<string | null>(
    (min, r) => (!min || r.weekStart < min ? r.weekStart : min),
    null
  );
  const back = Math.max(
    MIN_BACK,
    earliest ? weekOffset(current) - weekOffset(earliest) : 0
  );

  const top = addWeeks(current, AHEAD);
  const weeks = Array.from({ length: AHEAD + back + 1 }, (_, i) => addWeeks(top, -i));

  return (
    <>
      <header
        className="pagehead"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          padding: "18px 28px",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Schedule Payments</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            Pick a week to see or build its schedule · {weeks.length} weeks
          </div>
        </div>

        {isFinance && (
          <Link className="btn btn-secondary" href="/payments/approvals">
            <Wallet size={15} /> Approvals
            {waiting > 0 && (
              <span
                className="tag tag-accent"
                style={{ marginLeft: 2, padding: "1px 7px" }}
              >
                {waiting}
              </span>
            )}
          </Link>
        )}
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        <Blueprint style={{ padding: "12px 18px 14px" }}>
          <div
            className="tablewrap"
            style={{ maxHeight: "min(64vh, 560px)", overflowY: "auto" }}
          >
            <table className="table" style={{ minWidth: 760, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={stickyHead}>Week</th>
                  <th style={stickyHead}>Schedule due</th>
                  <th style={{ ...stickyHead, textAlign: "right" }}>Payments</th>
                  <th style={stickyHead}>Submitted</th>
                  <th style={{ ...stickyHead, textAlign: "right" }}>Total</th>
                  <th style={{ ...stickyHead, width: 40 }} />
                </tr>
              </thead>

              <tbody>
                {weeks.map((monday) => {
                  const weekRows = rows.filter((r) => r.weekStart === monday);
                  const total = weekRows.reduce((s, r) => s + r.amount, 0);
                  const submitted = pms.filter((p) =>
                    submissions.some(
                      (s) => s.pmId === p.id && s.weekStart === monday && s.submittedAt
                    )
                  ).length;
                  const isCurrent = monday === current;
                  const complete = submitted === pms.length && pms.length > 0;

                  return (
                    <tr
                      key={monday}
                      className="clickrow"
                      onClick={() => router.push(`/payments/${monday}`)}
                      style={
                        isCurrent
                          ? {
                              background:
                                "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                            }
                          : undefined
                      }
                    >
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        <Link
                          className="rowlink"
                          href={`/payments/${monday}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontWeight: isCurrent ? 600 : 400 }}
                        >
                          {weekLabel(monday)}
                        </Link>
                        <div style={{ fontSize: 11, color: MUTED }}>
                          {relativeWeekLabel(monday)}
                        </div>
                      </td>
                      <td style={{ ...cell, whiteSpace: "nowrap", fontSize: 13 }}>
                        {deadlineLabel(monday)}
                      </td>
                      <td style={{ ...numCell, fontSize: 13 }} className="tabular">
                        {weekRows.length || "—"}
                      </td>
                      <td style={cell}>
                        {complete ? (
                          <span className="tag tag-accent">All {pms.length} in</span>
                        ) : submitted > 0 ? (
                          <span className="tag tag-neutral">
                            {submitted} of {pms.length}
                          </span>
                        ) : (
                          <span style={{ color: MUTED, fontSize: 13 }}>Nothing yet</span>
                        )}
                      </td>
                      <td
                        style={{ ...numCell, fontWeight: total ? 600 : 400 }}
                        className="tabular"
                      >
                        {total ? money(total) : "—"}
                      </td>
                      <td style={{ ...cell, textAlign: "right", color: MUTED }}>
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Blueprint>
      </div>
    </>
  );
}
