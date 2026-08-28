/**
 * The payment schedule's shapes and rules.
 *
 * This is the domain — it stays when lib/paymentsMock.ts is deleted and
 * the real tables arrive. `PaymentRow` is the shape the API will return.
 */

export type PM = { id: string; name: string };
export type Project = { id: string; name: string };

/** Proof that a payment actually went out — usually a pasted screenshot. */
export type ProofFile = {
  name: string;
  sizeBytes: number;
  type: string;
  /** Object URL. Lives for this browser session only; a real upload replaces it. */
  url: string;
};

/** One expected payment. A row in the schedule. */
export type PaymentRow = {
  id: string;
  /** Monday of the week this payment belongs to. */
  weekStart: string;
  /** The day it's expected to go out, YYYY-MM-DD. */
  date: string;
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
  /** Wire number, cheque number, whatever the bank calls it. */
  paidReference?: string;
  proof?: ProofFile;

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

/** Did this PM hand in this week? */
export const isWeekSubmitted = (
  submissions: WeekSubmission[],
  pmId: string,
  weekStart: string
) =>
  submissions.some(
    (s) => s.pmId === pmId && s.weekStart === weekStart && s.submittedAt
  );
