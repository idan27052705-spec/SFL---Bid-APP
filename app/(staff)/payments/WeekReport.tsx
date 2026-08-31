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
  FileText,
  ImageIcon,
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
import ReopenRequestModal from "./ReopenRequestModal";
import { usePayments } from "./PaymentsProvider";
import { SortHeader, nextSort, sortRows, type Sort, type SortKey } from "./sorting";
import { FAINT, MUTED, cell, headCell, numCell, subtotalCell } from "./sheet";
import { money } from "@/lib/format";
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
  isWeekSubmitted,
  paymentState,
  pendingReopen,
  type PaymentRow,
} from "@/lib/payments";
import { canEditRow } from "@/lib/paymentsGuard";

type PmState = "submitted" | "draft" | "none";

/** One week's schedule: who is paying what, on which day. */
export default function WeekReport({ week }: { week: string }) {
  const {
    me,
    pms,
    projects,
    isOwner,
    canWrite,
    isFinance,
    rows,
    submissions,
    reopenRequests,
    saveRow,
    removeRow,
    setSubmitted,
    requestReopen,
  } = usePayments();
  const router = useRouter();

  const [pmFilter, setPmFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  /** Soonest first — the order you read a week in when you are paying it. */
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "asc" });
  const [groupByDay, setGroupByDay] = useState(false);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);
  const [askingReopen, setAskingReopen] = useState(false);

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
  const mine = weekRows.filter((r) => r.pmId === me.id);
  const myTotal = mine.reduce((sum, r) => sum + r.amount, 0);
  const mySentBack = mine.filter((r) => r.rejectedAt).length;
  const iSubmitted = pmState(me.id) === "submitted";

  /** My outstanding ask to have this week unlocked, if I have made one. */
  const myReopen = pendingReopen(reopenRequests, me.id, week);

  /** Every permission question in the app is answered in lib/paymentsGuard. */
  const canEdit = (row: PaymentRow) =>
    canEditRow({ row, meId: me.id, isOwner, canWrite, weekSubmitted: iSubmitted });

  const togglePm = (pmId: string) =>
    setPmFilter((f) => (f.includes(pmId) ? f.filter((x) => x !== pmId) : [...f, pmId]));

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
      dayLabel(r.date),
      r.pmName,
      r.projectName,
      r.payTo,
      r.reason,
      r.amount,
      STATE_LABEL[stateOf(r)],
    ];

    if (groupByDay) {
      groupedDays.forEach((d) => {
        const dayRows = sorted.filter((r) => r.date === d);
        if (!dayRows.length) return;
        dayRows.forEach((r) => out.push(line(r)));
        out.push([
          `${dayName(d)} total`,
          "",
          "",
          "",
          "",
          dayRows.reduce((s, r) => s + r.amount, 0),
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
    const Icon = r.proof?.type.startsWith("image/") ? ImageIcon : FileText;
    return (
      <td style={cell}>
        <span className={STATE_TAG[state]}>{STATE_LABEL[state]}</span>
        {state === "Rejected" && r.rejectionReason && (
          <div style={{ fontSize: 11, color: "#b3261e", marginTop: 3, maxWidth: 220 }}>
            {r.rejectionReason}
          </div>
        )}
        {state === "Paid" &&
          (r.proof ? (
            <a
              className="rowlink noprint"
              href={r.proof.url}
              target="_blank"
              rel="noreferrer"
              title={r.proof.name}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                marginTop: 3,
              }}
            >
              <Icon size={11} /> Proof
            </a>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>no proof</div>
          ))}
      </td>
    );
  };

  const paymentRow = (r: PaymentRow) => (
    <tr key={r.id}>
      <td style={{ ...cell, whiteSpace: "nowrap" }}>{dayLabel(r.date)}</td>
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
                style={{ color: "#b3261e" }}
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

          {canWrite && (
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
          </span>

          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pms.map((pm) => {
              const state = pmState(pm.id);
              const on = pmFilter.includes(pm.id);
              return (
                <button
                  key={pm.id}
                  className={`tag ${state === "submitted" ? "tag-accent" : "tag-neutral"} noprint`}
                  onClick={() => togglePm(pm.id)}
                  title={
                    state === "submitted"
                      ? "Submitted — click to show only these rows"
                      : state === "draft"
                        ? "Started, not submitted yet"
                        : "Nothing entered for this week"
                  }
                  style={{
                    gap: 5,
                    cursor: "pointer",
                    border: on ? "1px solid var(--color-accent)" : "1px solid transparent",
                    opacity: state === "none" ? 0.55 : 1,
                  }}
                >
                  {state === "submitted" && <Check size={11} />}
                  {pm.id === me.id ? "You" : pm.name}
                  {state === "draft" && <span style={{ color: FAINT }}>draft</span>}
                  {state === "none" && <span style={{ color: FAINT }}>—</span>}
                </button>
              );
            })}
          </span>

          {isFinance && (
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
                <span style={{ color: "#b3261e" }}>
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
                disabled={mine.length === 0}
                onClick={() => setSubmitted(week, new Date().toISOString())}
                title={
                  mine.length === 0
                    ? "Add at least one payment before submitting"
                    : undefined
                }
              >
                <Check size={15} /> Submit week
              </button>
            )}
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
                  groupedDays.map((d) => {
                    const dayRows = sorted.filter((r) => r.date === d);
                    if (dayRows.length === 0) return null;
                    const dayTotal = dayRows.reduce((s, r) => s + r.amount, 0);

                    return (
                      <Fragment key={d}>
                        {dayRows.map(paymentRow)}
                        <tr>
                          <td style={subtotalCell} colSpan={5}>
                            <span style={{ color: MUTED }}>{dayName(d)} total</span>
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
          canPickPm={isOwner}
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
          canPickPm={isOwner}
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
          body={
            <>
              Remove <strong>{deleting.reason}</strong> — {money(deleting.amount)} to{" "}
              {deleting.payTo || "—"} on {dayLabel(deleting.date)}?
            </>
          }
          onConfirm={() => {
            removeRow(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}

      {askingReopen && (
        <ReopenRequestModal
          week={week}
          onConfirm={(message) => requestReopen(week, message)}
          onClose={() => setAskingReopen(false)}
        />
      )}
    </>
  );
}
