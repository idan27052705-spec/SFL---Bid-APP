"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowLeft,
  Check,
  LockOpen,
  Paperclip,
  Undo2,
  X,
} from "lucide-react";
import Blueprint from "@/components/Blueprint";
import MarkPaidModal from "./MarkPaidModal";
import ProofLink from "./ProofLink";
import RejectModal from "./RejectModal";
import { errorMessage, usePayments } from "./PaymentsProvider";
import {
  SortHeader,
  dayKey,
  nextSort,
  sortRows,
  type Sort,
  type SortKey,
} from "./sorting";
import { DANGER, MUTED, cell, errorLine, headCell, numCell } from "./sheet";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import { money } from "@/lib/format";
import { formatDate, timeAgo } from "@/lib/format";
import { dueLabel, today } from "@/lib/dates";
import { weekLabel } from "@/lib/weeks";
import {
  dayOrAny,
  dueDay,
  isRowOverdue,
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

/** The columns a payment waiting on finance is read in, in order. */
const PENDING_COLUMNS: { label: string; key: SortKey; align?: "right" }[] = [
  { label: "Due", key: "date" },
  { label: "PM", key: "pmName" },
  { label: "Project", key: "projectName" },
  { label: "Pay to", key: "payTo" },
  { label: "Reason for pay", key: "reason" },
  { label: "Amount", key: "amount", align: "right" },
];

/**
 * What the person handling the money opens in the morning.
 *
 * Four questions, four lists, in the order they get asked: what should
 * already be done, what needs me, what is stuck with someone else, and
 * what is already closed. Browsing week by week to find open items is
 * exactly what this replaces.
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
    paymentsRole,
    markPaid,
    rejectRow,
    resolveReopenRequest,
  } = usePayments();

  const [sort, setSort] = useState<Sort>({ key: "date", dir: "asc" });
  const [paying, setPaying] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);

  /** The request being answered, so both its buttons go quiet at once. */
  const [deciding, setDeciding] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const isAdmin = isPaymentsAdmin(paymentsRole);

  const stateOf = (r: PaymentRow) =>
    paymentState(r, isWeekSubmitted(submissions, r.pmId, r.weekStart));

  /** One clock for the whole screen — every list below is judged against it. */
  const todayStr = today();

  /**
   * The payments whose day has been and gone with nobody having paid them
   * or sent them back. They are lifted out of the waiting list rather than
   * flagged inside it: a queue where the urgent thing is somewhere in the
   * middle, in a different colour, is a queue you have to read all of.
   *
   * Oldest first, and not re-sortable — there is exactly one order worth
   * reading this list in, and it is the order the phone calls will come in.
   */
  const overdue = useMemo(
    () =>
      rows
        .filter((r) => isRowOverdue(r, stateOf(r), todayStr))
        .sort((a, b) => dueDay(a).localeCompare(dueDay(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, submissions, todayStr]
  );

  const waiting = useMemo(
    () =>
      sortRows(
        rows.filter(
          (r) => stateOf(r) === "Pending" && !isRowOverdue(r, "Pending", todayStr)
        ),
        sort
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, submissions, sort, todayStr]
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
  const overdueTotal = overdue.reduce((s, r) => s + r.amount, 0);
  const missingProof = paid.filter((r) => !r.proofs?.length).length;

  const onSort = (key: SortKey) => setSort((s) => nextSort(s, key));

  /** Answering one ask. Both buttons wait for it, and say so if it fails. */
  async function decide(id: string, approved: boolean) {
    setDeciding(id);
    setDecisionError(null);
    try {
      await resolveReopenRequest(id, approved);
    } catch (e) {
      setDecisionError(errorMessage(e));
    } finally {
      setDeciding(null);
    }
  }

  if (!isAdmin) {
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

  /**
   * The Due cell doubles as the way back into the week it belongs to.
   *
   * On an overdue row it also says how long it has been sitting there —
   * "4 days overdue" is the sentence somebody is about to say on the
   * phone, and it belongs on the row rather than in the reader's head.
   */
  const dueCell = (r: PaymentRow, late = false) => (
    <td style={{ ...cell, whiteSpace: "nowrap" }}>
      <span
        style={
          late
            ? { color: DANGER, fontWeight: 600 }
            : r.date
              ? undefined
              : { color: MUTED }
        }
      >
        {dayOrAny(r.date)}
      </span>
      <div style={{ fontSize: 11 }}>
        <Link className="rowlink" href={`/payments/${r.weekStart}`} style={{ color: MUTED }}>
          {weekLabel(r.weekStart)}
        </Link>
        {late && (
          <span style={{ color: DANGER }}> · {dueLabel(dueDay(r))}</span>
        )}
      </div>
    </td>
  );

  /**
   * Overdue and Waiting are the same table twice — same columns, same two
   * buttons, same total — so they are built once. Only what carries
   * meaning differs: the overdue copy is pinned oldest-first instead of
   * sortable, and its due cell is red.
   */
  const pendingTable = ({
    list,
    total,
    totalLabel,
    late = false,
    empty,
  }: {
    list: PaymentRow[];
    total: number;
    totalLabel: string;
    late?: boolean;
    empty?: string;
  }) => (
    <Blueprint style={{ padding: "12px 18px 14px" }}>
      <div className="tablewrap">
        <table className="table" style={{ minWidth: 1020, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {PENDING_COLUMNS.map((col) =>
                late ? (
                  <th
                    key={col.key}
                    style={{ ...headCell, textAlign: col.align ?? "left" }}
                  >
                    {col.label}
                  </th>
                ) : (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    sort={sort}
                    onSort={onSort}
                    align={col.align}
                  />
                )
              )}
              <th style={{ ...headCell, width: 176 }} />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td style={{ ...cell, color: MUTED }} colSpan={7}>
                  {empty}
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.id}>
                  {dueCell(r, late)}
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.pmName}</td>
                  <td style={cell}>{r.projectName}</td>
                  <td style={cell}>{r.payTo || "—"}</td>
                  <td style={cell}>{r.reason}</td>
                  <td style={numCell} className="tabular">
                    {money(r.amount)}
                  </td>
                  <td style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn btn-primary" onClick={() => setPaying(r)}>
                      <Check size={14} /> Mark paid
                    </button>{" "}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setRejecting(r)}
                      title="Send back to the PM"
                      style={{ color: DANGER }}
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {list.length > 0 && (
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
                  {totalLabel}
                </td>
                <td
                  style={{
                    ...numCell,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 15,
                    color: late ? DANGER : undefined,
                  }}
                  className="tabular"
                >
                  {money(total)}
                </td>
                <td style={cell} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Blueprint>
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
        {files.map((file) => (
          <ProofLink key={file.id ?? file.url} file={file} label="View" />
        ))}
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
          {overdue.length > 0 && (
            <span style={{ color: DANGER, fontWeight: 600 }}>
              {" · "}
              {overdue.length} overdue
            </span>
          )}
          {reopens.length > 0 &&
            ` · ${reopens.length} reopen request${reopens.length === 1 ? "" : "s"}`}
          {sentBack.length > 0 && ` · ${sentBack.length} sent back`}
          {paid.length > 0 && ` · ${paid.length} paid`}
          {missingProof > 0 && ` · ${missingProof} with no proof`}
        </div>
      </header>

      {/*
        minmax(0, 1fr), not the default auto: an auto track is sized by its
        widest content, so the 1020px-wide tables stretched this grid to
        1058px and the whole page scrolled sideways on a phone — the one
        thing the tables scroll inside their own box to avoid. The same
        trick keeps the app shell honest in globals.css.
      */}
      <div
        className="pagebody"
        style={{
          padding: "24px 28px 40px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 26,
        }}
      >
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
                            onClick={() => decide(req.id, true)}
                            disabled={deciding === req.id}
                            title="Drop the week back to draft so they can edit and submit it again"
                          >
                            <LockOpen size={14} />{" "}
                            {deciding === req.id ? "Working…" : "Approve & reopen"}
                          </button>{" "}
                          <button
                            className="btn btn-ghost"
                            onClick={() => decide(req.id, false)}
                            disabled={deciding === req.id}
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

              {decisionError && (
                <div style={{ ...errorLine, marginTop: 8 }}>{decisionError}</div>
              )}
            </Blueprint>
          </section>
        )}

        {/* — what should already be done — */}
        {overdue.length > 0 && (
          <section>
            <div style={{ ...SECTION_TITLE, color: DANGER }}>
              <AlarmClock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Overdue
            </div>
            {pendingTable({
              list: overdue,
              total: overdueTotal,
              totalLabel: "Overdue total",
              late: true,
            })}
          </section>
        )}

        {/* — what needs me — */}
        <section>
          <div style={SECTION_TITLE}>Waiting to be paid</div>
          {pendingTable({
            list: waiting,
            total: waitingTotal,
            totalLabel: "Waiting total",
            empty:
              overdue.length > 0
                ? "Nothing else waiting — everything still open is overdue, above."
                : "Nothing waiting. Payments arrive here when a PM submits their week.",
          })}
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
          onConfirm={(details) => markPaid(paying.id, details)}
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
