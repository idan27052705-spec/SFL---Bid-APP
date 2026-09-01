"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LockOpen,
  Pencil,
  Plus,
  Printer,
  Sheet,
  Trash2,
} from "lucide-react";
import Blueprint from "@/components/Blueprint";
import FilterMenu from "@/components/FilterMenu";
import ConfirmModal from "@/components/ConfirmModal";
import PaymentModal from "./PaymentModal";
import ProofLink from "./ProofLink";
import ReopenRequestModal from "./ReopenRequestModal";
import { errorMessage, usePayments } from "./PaymentsProvider";
import { SortHeader, nextSort, sortRows, type Sort, type SortKey } from "./sorting";
import {
  DANGER,
  DANGER_TINT,
  FAINT,
  MUTED,
  cell,
  errorLine,
  headCell,
  numCell,
  subtotalCell,
} from "./sheet";
import { money } from "@/lib/format";
import { today } from "@/lib/dates";
import {
  addWeeks,
  dayLabel,
  dayName,
  deadlineLabel,
  relativeWeekLabel,
  weekDays,
  weekLabel,
} from "@/lib/weeks";
import {
  STATE_LABEL,
  STATE_TAG,
  dayOrAny,
  isDeadlinePast,
  isWeekSubmitted,
  latePms,
  paymentState,
  pendingReopen,
  type PM,
  type PaymentRow,
} from "@/lib/payments";
import {
  canAddToWeek,
  canChangeRow,
  isPaymentsAdmin,
  rowFacts,
} from "@/lib/paymentsGuard";

type PmState = "submitted" | "draft" | "none";

/** One week's schedule: who is paying what, on which day. */
export default function WeekReport({ week }: { week: string }) {
  const {
    me,
    pms,
    projects,
    paymentsRole,
    canWrite,
    rows,
    submissions,
    reopenRequests,
    saveRow,
    removeRow,
    submitWeek,
    requestReopen,
    reopenWeek,
  } = usePayments();
  const router = useRouter();

  /** Whoever handles the money. They are never locked out of a week. */
  const isAdmin = isPaymentsAdmin(paymentsRole);

  const [pmFilter, setPmFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  /** Soonest first — the order you read a week in when you are paying it. */
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "asc" });
  const [groupByDay, setGroupByDay] = useState(false);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [askingReopen, setAskingReopen] = useState(false);
  /** The PM whose week an admin is about to unlock, if they are. */
  const [unlocking, setUnlocking] = useState<PM | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const days = weekDays(week);

  const weekRows = useMemo(
    () => rows.filter((r) => r.weekStart === week),
    [rows, week]
  );

  const visible = useMemo(
    () =>
      weekRows.filter((r) => {
        if (pmFilter.length && !pmFilter.includes(r.pmId)) return false;
        if (projectFilter.length && !projectFilter.includes(r.projectName)) return false;
        return true;
      }),
    [weekRows, pmFilter, projectFilter]
  );

  const sorted = useMemo(() => sortRows(visible, sort), [visible, sort]);
  const weekTotal = visible.reduce((sum, r) => sum + r.amount, 0);

  /**
   * Filter by the project names actually in the week, not by a fixed list —
   * projects are typed, so a payment can name one nobody has set up yet and
   * it still has to be filterable.
   */
  const projectOptions = useMemo(
    () => Array.from(new Set(weekRows.map((r) => r.projectName))).sort(),
    [weekRows]
  );

  /** Days keep calendar order unless you are explicitly sorting by day. */
  const groupedDays =
    sort.key === "date" && sort.dir === "desc" ? [...days].reverse() : days;

  /**
   * What "Group by day" breaks the week into: the seven days, and then
   * everything nobody has put a day on.
   *
   * That last group is not a tidiness thing. A day subtotal is only worth
   * printing if the subtotals add up to the week total, and rows with no
   * day belong to no day — so they get a line of their own rather than
   * quietly vanishing out of the grouped view.
   */
  const dayGroups = [
    ...groupedDays.map((d) => ({
      key: d,
      label: dayName(d),
      rows: sorted.filter((r) => r.date === d),
    })),
    { key: "no-day", label: "No set day", rows: sorted.filter((r) => !r.date) },
  ].filter((g) => g.rows.length > 0);

  const onSort = (key: SortKey) => setSort((s) => nextSort(s, key));

  /* — submissions — */

  function pmState(pmId: string): PmState {
    const found = submissions.find((s) => s.pmId === pmId && s.weekStart === week);
    if (found?.submittedAt) return "submitted";
    return weekRows.some((r) => r.pmId === pmId) ? "draft" : "none";
  }

  const stateOf = (r: PaymentRow) =>
    paymentState(r, isWeekSubmitted(submissions, r.pmId, r.weekStart));

  const submittedCount = pms.filter((p) => pmState(p.id) === "submitted").length;

  /**
   * The deadline read once, and shared by every chip below.
   *
   * Thursday is not advice — a week nobody handed in is a week finance
   * cannot pay, so once the Thursday is behind us the PMs who still owe
   * it are named on the report rather than left looking like they simply
   * have nothing scheduled.
   */
  const todayStr = today();
  const deadlinePast = isDeadlinePast(week, todayStr);
  const lateCount = latePms(pms, submissions, week, todayStr).length;
  const mine = weekRows.filter((r) => r.pmId === me.id);
  const myTotal = mine.reduce((sum, r) => sum + r.amount, 0);
  const mySentBack = mine.filter((r) => r.rejectedAt).length;
  const iSubmitted = pmState(me.id) === "submitted";

  /** My outstanding ask to have this week unlocked, if I have made one. */
  const myReopen = pendingReopen(reopenRequests, me.id, week);

  /**
   * Every permission question in the app is answered in lib/paymentsGuard.
   *
   * The signature that locks a row is its own PM's, not the reader's — an
   * admin looking at somebody else's row has to be asking about the week
   * that row belongs to.
   */
  const canEdit = (row: PaymentRow) =>
    canChangeRow({
      row: rowFacts(row),
      meId: me.id,
      paymentsRole,
      canWrite,
      weekSubmitted: isWeekSubmitted(submissions, row.pmId, row.weekStart),
    });

  /** A PM cannot add to a week they signed. An admin always can. */
  const canAdd = canAddToWeek({ paymentsRole, canWrite, weekSubmitted: iSubmitted });

  const togglePm = (pmId: string) =>
    setPmFilter((f) => (f.includes(pmId) ? f.filter((x) => x !== pmId) : [...f, pmId]));

  /**
   * Handing the week in. The signature is the server's to record — this
   * only waits for it, and says so if it was refused rather than showing a
   * week as submitted when it isn't.
   */
  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitWeek(week);
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Excel opens CSV natively — no library, and the file stays readable in
   * anything else. Amounts go out as bare numbers so Excel can total them;
   * a "$12,400" string would land as text. The file follows whatever is on
   * screen: same sort, same grouping.
   */
  function exportCsv() {
    const out: (string | number)[][] = [
      ["Schedule Payments", weekLabel(week)],
      ["Exported", new Date().toLocaleString("en-US")],
      [],
      ["Day", "PM", "Project", "Pay to", "Reason for pay", "Amount", "Status"],
    ];

    const line = (r: PaymentRow) => [
      // A day nobody set is left blank rather than filled with a word:
      // the column is a date column, and Excel should be able to read it.
      r.date ? dayLabel(r.date) : "",
      r.pmName,
      r.projectName,
      r.payTo,
      r.reason,
      r.amount,
      STATE_LABEL[stateOf(r)],
    ];

    if (groupByDay) {
      dayGroups.forEach((g) => {
        g.rows.forEach((r) => out.push(line(r)));
        out.push([
          `${g.label} total`,
          "",
          "",
          "",
          "",
          g.rows.reduce((s, r) => s + r.amount, 0),
          "",
        ]);
      });
    } else {
      sorted.forEach((r) => out.push(line(r)));
    }

    out.push([]);
    out.push(["Week total", "", "", "", "", weekTotal, ""]);

    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = out.map((r) => r.map(escape).join(",")).join("\r\n");
    // The BOM is what makes Excel read accented names correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Schedule Payments — ${weekLabel(week)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = canWrite ? 8 : 7;

  const statusCell = (r: PaymentRow) => {
    const state = stateOf(r);
    const proofs = r.proofs ?? [];
    return (
      <td style={cell}>
        <span className={STATE_TAG[state]}>{STATE_LABEL[state]}</span>
        {/*
          Who sent it back matters as much as why: the PM reading this has
          to know which desk to answer, and an unsigned complaint on a row
          is how a payment sits untouched for a week.
        */}
        {state === "Rejected" && r.rejectionReason && (
          <div style={{ fontSize: 11, color: DANGER, marginTop: 3, maxWidth: 220 }}>
            {r.rejectedBy && `Reason by ${r.rejectedBy}: `}
            &ldquo;{r.rejectionReason}&rdquo;
          </div>
        )}
        {state === "Paid" &&
          (proofs.length ? (
            <div
              className="noprint"
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 3 }}
            >
              {proofs.map((file, i) => (
                <ProofLink
                  key={file.id ?? file.url}
                  file={file}
                  label={proofs.length === 1 ? "Proof" : `Proof ${i + 1}`}
                  size={11}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>no proof</div>
          ))}
      </td>
    );
  };

  const paymentRow = (r: PaymentRow) => (
    <tr key={r.id}>
      <td
        style={{
          ...cell,
          whiteSpace: "nowrap",
          color: r.date ? undefined : MUTED,
        }}
      >
        {dayOrAny(r.date)}
      </td>
      <td style={{ ...cell, whiteSpace: "nowrap" }}>
        {r.pmId === me.id ? <strong>{r.pmName}</strong> : r.pmName}
      </td>
      <td style={cell}>{r.projectName}</td>
      <td style={cell}>{r.payTo || "—"}</td>
      <td style={cell}>{r.reason}</td>
      <td style={numCell} className="tabular">
        {money(r.amount)}
      </td>
      {statusCell(r)}
      {canWrite && (
        <td
          style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}
          className="noprint"
        >
          {canEdit(r) ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setEditing(r)}
                aria-label={`Edit ${r.reason}`}
              >
                <Pencil size={14} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setDeleting(r)}
                aria-label={`Delete ${r.reason}`}
                style={{ color: DANGER }}
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : null}
        </td>
      )}
    </tr>
  );

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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          <div>
            <h1 style={{ fontSize: 30, margin: 0 }}>{weekLabel(week)}</h1>
            <div style={{ fontSize: 13, color: MUTED }}>
              {relativeWeekLabel(week)} · schedule due {deadlineLabel(week)}
            </div>
          </div>

          <div
            className="noprint"
            style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
          >
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => router.push(`/payments/${addWeeks(week, -1)}`)}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => router.push(`/payments/${addWeeks(week, 1)}`)}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/*
            A signed week has no Add button for its own PM: the way back in
            is to ask for the week, which is the button sitting a few
            inches below this one.
          */}
          {canAdd && (
            <button
              className="btn btn-primary blueprint noprint"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} /> Add payment
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
            </button>
          )}
        </div>
      </header>

      {/* — who has handed this week in — */}
      <div
        style={{
          padding: "14px 28px",
          borderBottom: "1px solid var(--color-divider)",
          background: "color-mix(in srgb, var(--color-text) 2.5%, transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          <span style={{ color: MUTED }}>
            <strong style={{ color: "var(--color-text)" }}>
              {submittedCount} of {pms.length}
            </strong>{" "}
            submitted
            {lateCount > 0 && (
              <span style={{ color: DANGER, fontWeight: 600 }}>
                {" · "}
                {lateCount} late
              </span>
            )}
          </span>

          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pms.map((pm) => {
              const state = pmState(pm.id);
              const late = deadlinePast && state !== "submitted";
              const on = pmFilter.includes(pm.id);
              return (
                <span
                  key={pm.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
                >
                  <button
                    className={`tag ${state === "submitted" ? "tag-accent" : "tag-neutral"} noprint`}
                    onClick={() => togglePm(pm.id)}
                    title={
                      state === "submitted"
                        ? "Submitted — click to show only these rows"
                        : late
                          ? `Late — the schedule was due ${deadlineLabel(week)} and ${
                              state === "draft"
                                ? "this is still a draft"
                                : "nothing has been entered"
                            }`
                          : state === "draft"
                            ? "Started, not submitted yet"
                            : "Nothing entered for this week"
                    }
                    style={{
                      gap: 5,
                      cursor: "pointer",
                      border: on
                        ? "1px solid var(--color-accent)"
                        : "1px solid transparent",
                      // A late chip keeps its full weight — an empty week that
                      // is also overdue is the loudest thing here, not the
                      // faintest.
                      opacity: state === "none" && !late ? 0.55 : 1,
                      ...(late ? { background: DANGER_TINT, color: DANGER } : null),
                    }}
                  >
                    {state === "submitted" && <Check size={11} />}
                    {pm.id === me.id ? "You" : pm.name}
                    {late ? (
                      <span style={{ fontWeight: 600 }}>late</span>
                    ) : state === "draft" ? (
                      <span style={{ color: FAINT }}>draft</span>
                    ) : state === "none" ? (
                      <span style={{ color: FAINT }}>—</span>
                    ) : null}
                  </button>

                  {/*
                    The admin's own way into a signed week. The request
                    queue is how a PM gets one back; this is for the
                    mistakes nobody is going to ask about — a week signed a
                    day early, a row that is obviously wrong — and it sits
                    on the chip that says the week is shut.
                  */}
                  {isAdmin && state === "submitted" && (
                    <button
                      className="btn btn-ghost noprint"
                      onClick={() => {
                        setUnlockError(null);
                        setUnlocking(pm);
                      }}
                      aria-label={`Reopen this week for ${pm.name}`}
                      title={`Reopen this week for ${
                        pm.id === me.id ? "yourself" : pm.name
                      } — no request needed`}
                      style={{ padding: "0 2px", color: MUTED }}
                    >
                      <LockOpen size={12} />
                    </button>
                  )}
                </span>
              );
            })}
          </span>

          {isAdmin && (
            <Link
              className="btn btn-ghost noprint"
              href="/payments/approvals"
              style={{ marginLeft: "auto" }}
            >
              Approvals →
            </Link>
          )}
        </div>

        {canWrite && (
          <div
            className="noprint"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--color-divider)",
              fontSize: 13,
            }}
          >
            <span>
              <strong>Your week:</strong> {mine.length} payment
              {mine.length === 1 ? "" : "s"}
              {mine.length > 0 && ` · ${money(myTotal)}`}
              {" · "}
              <span style={{ color: iSubmitted ? "var(--color-accent-700)" : MUTED }}>
                {iSubmitted ? "Submitted" : "Draft"}
              </span>
              {mySentBack > 0 && (
                <span style={{ color: DANGER }}>
                  {" · "}
                  {mySentBack} sent back
                </span>
              )}
            </span>

            {/*
              Handing the week in is final from this side — the way out is to
              ask the admin, so the report finance reads cannot change under
              them without somebody agreeing to it.
            */}
            {iSubmitted ? (
              myReopen ? (
                <span
                  title={myReopen.message}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: MUTED,
                  }}
                >
                  <LockOpen size={14} /> Reopen requested — waiting for approval
                </span>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => setAskingReopen(true)}
                  title="Ask whoever handles the payments to unlock this week"
                >
                  <LockOpen size={15} /> Request to reopen
                </button>
              )
            ) : (
              <button
                className="btn btn-primary"
                disabled={mine.length === 0 || submitting}
                onClick={submit}
                title={
                  mine.length === 0
                    ? "Add at least one payment before submitting"
                    : undefined
                }
              >
                <Check size={15} /> {submitting ? "Submitting…" : "Submit week"}
              </button>
            )}

            {submitError && <span style={errorLine}>{submitError}</span>}
          </div>
        )}
      </div>

      <div className="pagebody" style={{ padding: "22px 28px 40px" }}>
        <div
          className="noprint"
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <FilterMenu
            label="PM"
            title="Filter by project manager"
            options={pms.map((p) => ({
              id: p.id,
              label: p.id === me.id ? `${p.name} (you)` : p.name,
            }))}
            selected={pmFilter}
            onChange={setPmFilter}
          />
          {projectOptions.length > 0 && (
            <FilterMenu
              label="Project"
              title="Filter by project"
              options={projectOptions.map((name) => ({ id: name, label: name }))}
              selected={projectFilter}
              onChange={setProjectFilter}
            />
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setGroupByDay((g) => !g)}
            aria-pressed={groupByDay}
            title={
              groupByDay
                ? "Showing a subtotal per day"
                : "Break the week into days, with a subtotal for each"
            }
            style={
              groupByDay
                ? {
                    borderColor: "var(--color-accent)",
                    background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  }
                : undefined
            }
          >
            <CalendarDays size={15} /> Group by day
          </button>

          <span style={{ fontSize: 12, color: MUTED }}>
            {visible.length} payment{visible.length === 1 ? "" : "s"} ·{" "}
            {money(weekTotal)}
            {visible.length !== weekRows.length && ` · ${weekRows.length} in the week`}
          </span>

          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportCsv}
              disabled={visible.length === 0}
            >
              <Sheet size={15} /> Export to Excel
            </button>
          </span>
        </div>

        <Blueprint className="printable" style={{ padding: "12px 18px 14px" }}>
          <div className="tablewrap">
            <table className="table" style={{ minWidth: 1080, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="Day" sortKey="date" sort={sort} onSort={onSort} />
                  <SortHeader label="PM" sortKey="pmName" sort={sort} onSort={onSort} />
                  <SortHeader
                    label="Project"
                    sortKey="projectName"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader label="Pay to" sortKey="payTo" sort={sort} onSort={onSort} />
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
                  <th style={{ ...headCell, width: 150 }}>Status</th>
                  {canWrite && (
                    <th style={{ ...headCell, width: 78 }} className="noprint" />
                  )}
                </tr>
              </thead>

              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td style={{ ...cell, color: MUTED }} colSpan={columns}>
                      {weekRows.length === 0
                        ? "Nothing scheduled for this week yet. Add the payments you expect to make."
                        : "Nothing matches those filters."}
                    </td>
                  </tr>
                ) : groupByDay ? (
                  dayGroups.map((g) => {
                    const dayTotal = g.rows.reduce((s, r) => s + r.amount, 0);

                    return (
                      <Fragment key={g.key}>
                        {g.rows.map(paymentRow)}
                        <tr>
                          <td style={subtotalCell} colSpan={5}>
                            <span style={{ color: MUTED }}>{g.label} total</span>
                          </td>
                          <td
                            style={{ ...subtotalCell, textAlign: "right", fontWeight: 600 }}
                            className="tabular"
                          >
                            {money(dayTotal)}
                          </td>
                          <td style={subtotalCell} />
                          {canWrite && <td style={subtotalCell} className="noprint" />}
                        </tr>
                      </Fragment>
                    );
                  })
                ) : (
                  sorted.map(paymentRow)
                )}
              </tbody>

              {sorted.length > 0 && (
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
                      Week total
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
                      {money(weekTotal)}
                    </td>
                    <td style={cell} />
                    {canWrite && <td style={cell} className="noprint" />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Blueprint>
      </div>

      {adding && (
        <PaymentModal
          weekStart={week}
          projects={projects}
          pms={pms}
          me={me}
          canPickPm={isAdmin}
          onSave={saveRow}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <PaymentModal
          weekStart={week}
          projects={projects}
          pms={pms}
          me={me}
          canPickPm={isAdmin}
          payment={editing}
          onSave={saveRow}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete payment"
          danger
          confirmLabel="Delete payment"
          busyLabel="Deleting…"
          body={
            <>
              Remove <strong>{deleting.reason}</strong> — {money(deleting.amount)} to{" "}
              {deleting.payTo || "—"} ({dayOrAny(deleting.date)})?
              {deleteError && (
                <div style={{ ...errorLine, marginTop: 10 }}>{deleteError}</div>
              )}
            </>
          }
          onConfirm={async () => {
            setDeleteError(null);
            try {
              await removeRow(deleting.id);
              setDeleting(null);
            } catch (e) {
              setDeleteError(errorMessage(e));
            }
          }}
          onClose={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}

      {askingReopen && (
        <ReopenRequestModal
          week={week}
          onConfirm={(message) => requestReopen(week, message)}
          onClose={() => setAskingReopen(false)}
        />
      )}

      {unlocking && (
        <ConfirmModal
          title="Reopen this week"
          confirmLabel="Reopen the week"
          busyLabel="Reopening…"
          body={
            <>
              Drop <strong>{weekLabel(week)}</strong> back to draft for{" "}
              <strong>{unlocking.id === me.id ? "yourself" : unlocking.name}</strong>?{" "}
              {unlocking.id === me.id ? "You" : "They"} can edit it and submit it
              again — nothing already entered is lost.
              {unlockError && (
                <div style={{ ...errorLine, marginTop: 10 }}>{unlockError}</div>
              )}
            </>
          }
          onConfirm={async () => {
            setUnlockError(null);
            try {
              await reopenWeek(unlocking.id, week);
              setUnlocking(null);
            } catch (e) {
              setUnlockError(errorMessage(e));
            }
          }}
          onClose={() => {
            setUnlocking(null);
            setUnlockError(null);
          }}
        />
      )}
    </>
  );
}
