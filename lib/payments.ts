/**
 * The payment schedule's shapes and rules.
 *
 * This is the domain — it stays when lib/paymentsMock.ts is deleted and
 * the real tables arrive. `PaymentRow` is the shape the API will return.
 */

import { today } from "@/lib/dates";
import { addDays, dayLabel, submissionDeadline } from "@/lib/weeks";

export type PM = { id: string; name: string };
export type Project = { id: string; name: string };

/** Proof that a payment actually went out — usually a pasted screenshot. */
export type ProofFile = {
  /**
   * The payment_proofs row, once the file is stored. Absent while the file
   * is still only in the browser — a screenshot that has been pasted into
   * the mark-paid dialog but not yet saved has nothing to point at.
   */
  id?: string;
  name: string;
  sizeBytes: number;
  type: string;
  /**
   * Where to read the file. An object URL while it is only in the browser;
   * once stored, the route that hands back a signed URL for it — the
   * bucket is private, so there is never a link straight to the object.
   */
  url: string;
};

/** How the money actually left — recorded when the payment is marked paid. */
export const PAYMENT_METHODS = [
  "Zelle",
  "ACH",
  "Wire transfer",
  "Check",
  "Cash",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** One expected payment. A row in the schedule. */
export type PaymentRow = {
  id: string;
  /** Monday of the week this payment belongs to. */
  weekStart: string;
  /**
   * The day it's expected to go out, YYYY-MM-DD — null when the PM only
   * knows the week. Most payments are only known by week, not by day: a PM
   * filling Thursday's schedule knows the draw is due next week, not that
   * it goes out on the Wednesday, and making them guess puts a date on the
   * report that nobody meant.
   */
  date: string | null;
  pmId: string;
  pmName: string;
  /** Null when the PM typed a project that is not on the list. */
  projectId: string | null;
  projectName: string;
  payTo: string;
  reason: string;
  amount: number;

  /* — set by whoever handles the money, never by the PM — */
  paidAt?: string;
  paidBy?: string;
  paidMethod?: PaymentMethod;
  /** Wire number, cheque number, whatever the bank calls it. */
  paidReference?: string;
  /**
   * Every file attached as evidence. One payment often has more than one —
   * the bank confirmation and the invoice it settles — and a second
   * screenshot must never quietly overwrite the first.
   */
  proofs?: ProofFile[];

  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
};

/** One PM's schedule for one week — this is what gets submitted. */
export type WeekSubmission = {
  pmId: string;
  weekStart: string;
  submittedAt: string | null;
};

/**
 * A PM asking for a week they already handed in to be unlocked.
 *
 * Submitting is a signature, and a signature you can quietly take back is
 * not one. The week report is what the money gets paid from, so the totals
 * on it have to be the totals the PM stood behind at the moment they signed
 * — otherwise a week can change under finance while they are paying it, and
 * nobody can say afterwards which version was agreed. So the PM asks, and
 * whoever handles the money decides; the message is all they decide on.
 */
export type ReopenRequest = {
  id: string;
  pmId: string;
  pmName: string;
  /** Monday of the week they want back. */
  weekStart: string;
  message: string;
  createdAt: string;
  status: "pending" | "approved" | "declined";
  resolvedAt?: string;
  resolvedBy?: string;
};

export const PAYMENT_STATES = ["Draft", "Pending", "Paid", "Rejected"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * A row's state is derived, never stored twice.
 *
 * Only two things are recorded against a row — that it was paid, or that
 * it was sent back. Everything before that follows from whether its PM has
 * handed the week in, which is what makes "Submit week" mean something:
 * it is the moment the rows become somebody else's problem.
 */
export function paymentState(
  row: PaymentRow,
  weekSubmitted: boolean
): PaymentState {
  if (row.paidAt) return "Paid";
  if (row.rejectedAt) return "Rejected";
  return weekSubmitted ? "Pending" : "Draft";
}

/** What each state is called on screen, and the tag class it wears. */
export const STATE_LABEL: Record<PaymentState, string> = {
  Draft: "Draft",
  Pending: "Pending",
  Paid: "Paid",
  Rejected: "Needs attention",
};

export const STATE_TAG: Record<PaymentState, string> = {
  Draft: "tag tag-neutral",
  Pending: "tag tag-accent-2",
  Paid: "tag tag-accent",
  Rejected: "tag tag-neutral",
};

/**
 * The day a row shows, for the rows that have one.
 *
 * A payment with no day still belongs to the week, so it never reads as a
 * blank cell or an em dash — those look like something is missing. It says
 * what is true: it goes out this week, some day.
 */
export const dayOrAny = (date: string | null) =>
  date ? dayLabel(date) : "Any day";

/** Did this PM hand in this week? */
export const isWeekSubmitted = (
  submissions: WeekSubmission[],
  pmId: string,
  weekStart: string
) =>
  submissions.some(
    (s) => s.pmId === pmId && s.weekStart === weekStart && s.submittedAt
  );

/** The reopen this PM is still waiting on for this week, if any. */
export const pendingReopen = (
  requests: ReopenRequest[],
  pmId: string,
  weekStart: string
) =>
  requests.find(
    (r) => r.pmId === pmId && r.weekStart === weekStart && r.status === "pending"
  );

/* ─────────────────────────────────────────────────────────────
   Two deadlines, and what it means to have missed one.

   Both take today as an argument, defaulting to the company's today.
   A screen that shows a dozen weeks at once should read the clock once
   and pass the same day down — otherwise a render that straddles
   midnight can call the same week late in one row and not the next.
   It also makes these testable without moving the clock.
   ─────────────────────────────────────────────────────────── */

/** Has the Thursday this week's schedules were due already gone by? */
export const isDeadlinePast = (weekStart: string, todayStr: string = today()) =>
  todayStr > submissionDeadline(weekStart);

/**
 * The PMs who owe this week and are out of time.
 *
 * "Late" is not a state anybody sets — nobody marks a PM late, and there
 * is no forgiving it later. It is simply the deadline having passed with
 * nothing handed in, which stays true forever after: a week missed in
 * March still reads as missed in June. A half-filled draft counts as
 * late, because a draft is not a submission — it is what late looks
 * like from the inside.
 */
export function latePms(
  pms: PM[],
  submissions: WeekSubmission[],
  weekStart: string,
  todayStr: string = today()
): PM[] {
  if (!isDeadlinePast(weekStart, todayStr)) return [];
  return pms.filter((pm) => !isWeekSubmitted(submissions, pm.id, weekStart));
}

/**
 * The day a payment is actually due.
 *
 * Most rows only know their week, and a week's last claim on a payment
 * is its Sunday — so a row with no day is due at the end of its week
 * rather than never. That is what lets dated and undated rows be sorted
 * and judged late against each other at all.
 */
export const dueDay = (row: PaymentRow) => row.date ?? addDays(row.weekStart, 6);

/**
 * A payment whose moment has passed with nobody having dealt with it.
 *
 * Only Pending rows can be overdue: a paid row is done and a sent-back
 * row is the PM's problem, not finance's. Takes the state rather than
 * deriving it, because the caller has already worked it out and the
 * submissions list is the one thing this file's helpers don't hold.
 */
export const isRowOverdue = (
  row: PaymentRow,
  state: PaymentState,
  todayStr: string = today()
) => state === "Pending" && dueDay(row) < todayStr;
