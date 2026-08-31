"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  FileText,
  ImageIcon,
  LockOpen,
  Paperclip,
  Undo2,
  X,
} from "lucide-react";
import Blueprint from "@/components/Blueprint";
import MarkPaidModal from "./MarkPaidModal";
import RejectModal from "./RejectModal";
import { usePayments, type PaidDetails } from "./PaymentsProvider";
import {
  SortHeader,
  dayKey,
  nextSort,
  sortRows,
  type Sort,
  type SortKey,
} from "./sorting";
import { MUTED, cell, headCell, numCell } from "./sheet";
import { money } from "@/lib/format";
import { formatDate, timeAgo } from "@/lib/format";
import { weekLabel } from "@/lib/weeks";
import {
  dayOrAny,
  isWeekSubmitted,
  paymentState,
  type PaymentRow,
} from "@/lib/payments";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  marginBottom: 8,
};

/**
 * What the person handling the money opens in the morning.
 *
 * Three questions, three lists, in the order they get asked: what needs me,
 * what is stuck with someone else, and what is already closed. Browsing
 * week by week to find open items is exactly what this replaces.
 *
 * Reopen requests sit above all of it whenever there are any. A PM whose
 * week is locked cannot get on with anything until one is answered, and
 * answering one takes a second — so it goes first, not last.
 */
export default function ApprovalsQueue() {
  const {
    rows,
    submissions,
    reopenRequests,
    isFinance,
    markPaid,
    rejectRow,
    resolveReopenRequest,
  } = usePayments();

  const [sort, setSort] = useState<Sort>({ key: "date", dir: "asc" });
  const [paying, setPaying] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);

  const stateOf = (r: PaymentRow) =>
    paymentState(r, isWeekSubmitted(submissions, r.pmId, r.weekStart));

  const waiting = useMemo(
    () => sortRows(rows.filter((r) => stateOf(r) === "Pending"), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, submissions, sort]
  );

  const sentBack = useMemo(
    () =>
      rows
        .filter((r) => stateOf(r) === "Rejected")
        .sort((a, b) => dayKey(a).localeCompare(dayKey(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, submissions]
  );

  const paid = useMemo(
    () =>
      rows
        .filter((r) => r.paidAt)
        .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")),
    [rows]
  );

  /** Oldest first — the PM who has been stuck longest gets answered first. */
  const reopens = useMemo(
    () =>
      reopenRequests
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [reopenRequests]
  );

  const waitingTotal = waiting.reduce((s, r) => s + r.amount, 0);
  const missingProof = paid.filter((r) => !r.proofs?.length).length;

  const onSort = (key: SortKey) => setSort((s) => nextSort(s, key));

  if (!isFinance) {
    return (
      <div className="pagebody" style={{ padding: "40px 28px" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Approvals</h1>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          This screen is for whoever handles the payments.
        </p>
        <Link className="btn btn-secondary" href="/payments">
          Back to all weeks
        </Link>
      </div>
    );
  }

  /** The Due cell doubles as the way back into the week it belongs to. */
  const dueCell = (r: PaymentRow) => (
    <td style={{ ...cell, whiteSpace: "nowrap" }}>
      <span style={r.date ? undefined : { color: MUTED }}>{dayOrAny(r.date)}</span>
      <div style={{ fontSize: 11 }}>
        <Link className="rowlink" href={`/payments/${r.weekStart}`} style={{ color: MUTED }}>
          {weekLabel(r.weekStart)}
        </Link>
      </div>
    </td>
  );

  /** One line per file — the count is part of what the cell has to say. */
  const proofLinks = (r: PaymentRow) => {
    const files = r.proofs ?? [];
    if (!files.length)
      return (
        <span style={{ fontSize: 12, color: MUTED }} title="Paid with no proof attached">
          no proof
        </span>
      );
    return (
      <div style={{ display: "grid", gap: 3 }}>
        {files.map((file) => {
          const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
          return (
            <a
              key={file.url}
              className="rowlink"
              href={file.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
              }}
              title={file.name}
            >
              <Icon size={13} /> View
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <header
        className="pagehead"
        style={{
          padding: "14px 28px 18px",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <Link className="btn btn-ghost noprint" href="/payments" style={{ padding: 0 }}>
          <ArrowLeft size={14} /> All weeks
        </Link>

        <h1 style={{ fontSize: 30, margin: "6px 0 0" }}>Approvals</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          <strong style={{ color: "var(--color-text)" }}>
            {waiting.length} waiting
          </strong>
          {waiting.length > 0 && ` · ${money(waitingTotal)}`}
          {reopens.length > 0 &&
            ` · ${reopens.length} reopen request${reopens.length === 1 ? "" : "s"}`}
          {sentBack.length > 0 && ` · ${sentBack.length} sent back`}
          {paid.length > 0 && ` · ${paid.length} paid`}
          {missingProof > 0 && ` · ${missingProof} with no proof`}
        </div>
      </header>

      <div className="pagebody" style={{ padding: "24px 28px 40px", display: "grid", gap: 26 }}>
        {/* — somebody is locked out until this is answered — */}
        {reopens.length > 0 && (
          <section>
            <div style={SECTION_TITLE}>
              <LockOpen size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Reopen requests
            </div>
            <Blueprint style={{ padding: "12px 18px 14px" }}>
              <div className="tablewrap">
                <table
                  className="table"
                  style={{ minWidth: 900, borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th style={headCell}>PM</th>
                      <th style={headCell}>Week</th>
                      <th style={headCell}>Why they need it</th>
                      <th style={{ ...headCell, width: 232 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {reopens.map((req) => (
                      <tr key={req.id}>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          {req.pmName}
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          <Link className="rowlink" href={`/payments/${req.weekStart}`}>
                            {weekLabel(req.weekStart)}
                          </Link>
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {timeAgo(req.createdAt)}
                          </div>
                        </td>
                        <td style={cell}>{req.message}</td>
                        <td
                          style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}
                        >
                          <button
                            className="btn btn-primary"
                            onClick={() => resolveReopenRequest(req.id, true)}
                            title="Drop the week back to draft so they can edit and submit it again"
                          >
                            <LockOpen size={14} /> Approve &amp; reopen
                          </button>{" "}
                          <button
                            className="btn btn-ghost"
                            onClick={() => resolveReopenRequest(req.id, false)}
                            title="Leave the week submitted"
                          >
                            Decline
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Blueprint>
          </section>
        )}

        {/* — what needs me — */}
        <section>
          <div style={SECTION_TITLE}>Waiting to be paid</div>
          <Blueprint style={{ padding: "12px 18px 14px" }}>
            <div className="tablewrap">
              <table
                className="table"
                style={{ minWidth: 1020, borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <SortHeader label="Due" sortKey="date" sort={sort} onSort={onSort} />
                    <SortHeader label="PM" sortKey="pmName" sort={sort} onSort={onSort} />
                    <SortHeader
                      label="Project"
                      sortKey="projectName"
                      sort={sort}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Pay to"
                      sortKey="payTo"
                      sort={sort}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Reason for pay"
                      sortKey="reason"
                      sort={sort}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Amount"
                      sortKey="amount"
                      sort={sort}
                      onSort={onSort}
                      align="right"
                    />
                    <th style={{ ...headCell, width: 176 }} />
                  </tr>
                </thead>
                <tbody>
                  {waiting.length === 0 ? (
                    <tr>
                      <td style={{ ...cell, color: MUTED }} colSpan={7}>
                        Nothing waiting. Payments arrive here when a PM submits their
                        week.
                      </td>
                    </tr>
                  ) : (
                    waiting.map((r) => (
                      <tr key={r.id}>
                        {dueCell(r)}
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.pmName}</td>
                        <td style={cell}>{r.projectName}</td>
                        <td style={cell}>{r.payTo || "—"}</td>
                        <td style={cell}>{r.reason}</td>
                        <td style={numCell} className="tabular">
                          {money(r.amount)}
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => setPaying(r)}
                          >
                            <Check size={14} /> Mark paid
                          </button>{" "}
                          <button
                            className="btn btn-ghost"
                            onClick={() => setRejecting(r)}
                            title="Send back to the PM"
                            style={{ color: "#b3261e" }}
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {waiting.length > 0 && (
                  <tfoot>
                    <tr>
                      <td
                        style={{
                          ...cell,
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                        }}
                        colSpan={5}
                      >
                        Waiting total
                      </td>
                      <td
                        style={{
                          ...numCell,
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                        className="tabular"
                      >
                        {money(waitingTotal)}
                      </td>
                      <td style={cell} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Blueprint>
        </section>

        {/* — stuck with someone else — */}
        {sentBack.length > 0 && (
          <section>
            <div style={SECTION_TITLE}>
              <Undo2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Sent back — waiting on the PM
            </div>
            <Blueprint style={{ padding: "12px 18px 14px" }}>
              <div className="tablewrap">
                <table
                  className="table"
                  style={{ minWidth: 900, borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th style={headCell}>Due</th>
                      <th style={headCell}>PM</th>
                      <th style={headCell}>Pay to</th>
                      <th style={headCell}>What you asked for</th>
                      <th style={{ ...headCell, textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentBack.map((r) => (
                      <tr key={r.id}>
                        {dueCell(r)}
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.pmName}</td>
                        <td style={cell}>{r.payTo || "—"}</td>
                        <td style={cell}>
                          {r.rejectionReason}
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {r.reason}
                          </div>
                        </td>
                        <td style={numCell} className="tabular">
                          {money(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Blueprint>
          </section>
        )}

        {/* — already closed — */}
        {paid.length > 0 && (
          <section>
            <div style={SECTION_TITLE}>
              <Paperclip size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Paid
            </div>
            <Blueprint style={{ padding: "12px 18px 14px" }}>
              <div
                className="tablewrap"
                style={{ maxHeight: "min(48vh, 420px)", overflowY: "auto" }}
              >
                <table
                  className="table"
                  style={{ minWidth: 980, borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th style={headCell}>Paid</th>
                      <th style={headCell}>PM</th>
                      <th style={headCell}>Pay to</th>
                      <th style={headCell}>Reason for pay</th>
                      <th style={headCell}>Method / ref.</th>
                      <th style={{ ...headCell, textAlign: "right" }}>Amount</th>
                      <th style={{ ...headCell, width: 90 }}>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          {formatDate(r.paidAt)}
                          <div style={{ fontSize: 11, color: MUTED }}>{r.paidBy}</div>
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.pmName}</td>
                        <td style={cell}>{r.payTo || "—"}</td>
                        <td style={cell}>{r.reason}</td>
                        {/*
                          How it was paid and what the bank calls it are two
                          different answers to "which payment was this?" —
                          the method reads as words, the reference as a code.
                        */}
                        <td style={{ ...cell, fontSize: 13 }}>
                          {r.paidMethod || "—"}
                          <div
                            className="mono"
                            style={{ fontSize: 11, color: MUTED }}
                          >
                            {r.paidReference || "—"}
                          </div>
                        </td>
                        <td style={numCell} className="tabular">
                          {money(r.amount)}
                        </td>
                        <td style={cell}>{proofLinks(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Blueprint>
          </section>
        )}
      </div>

      {paying && (
        <MarkPaidModal
          payment={paying}
          onConfirm={(details: PaidDetails) => markPaid(paying.id, details)}
          onClose={() => setPaying(null)}
        />
      )}

      {rejecting && (
        <RejectModal
          payment={rejecting}
          onConfirm={(reason) => rejectRow(rejecting.id, reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </>
  );
}
