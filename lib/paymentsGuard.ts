/**
 * Who is allowed to change a payment row.
 *
 * Deliberately the ONE place a permission question gets answered. These
 * rules are the kind that get copied into whichever screen needs them and
 * then drift apart — the week report says a row is locked, some future
 * screen still shows the pencil, and the disagreement is nobody's bug in
 * particular. Keeping it here means the roles system, when it arrives,
 * changes this file and nothing else.
 */

import type { PaymentRow } from "@/lib/payments";

/**
 * Who you are to the payment schedule, which is not who you are to the
 * rest of the app.
 *
 * An 'admin' is whoever handles the money: they pay rows, send them back,
 * and undo mistakes anywhere in the company. Everyone else is a 'pm' —
 * they own their own week and nothing else. An owner is always an admin
 * regardless of what profiles.payments_role says, because someone must
 * always be able to pay a week and undo a mistake.
 */
export type PaymentsRole = "admin" | "pm";

/** Derive it from a profile's two role columns. The only place that decides. */
export const paymentsRoleOf = (
  role: string | null | undefined,
  paymentsRole: string | null | undefined
): PaymentsRole =>
  role === "owner" || paymentsRole === "admin" ? "admin" : "pm";

/**
 * The three facts about a row every rule below actually turns on.
 *
 * Named separately so the server can answer these questions straight off a
 * database row without first building a whole `PaymentRow` — the rules are
 * the same either way, and this is the file that owns them.
 */
export type RowFacts = {
  pmId: string;
  paid: boolean;
  rejected: boolean;
};

export const rowFacts = (row: PaymentRow): RowFacts => ({
  pmId: row.pmId,
  paid: Boolean(row.paidAt),
  rejected: Boolean(row.rejectedAt),
});

export type RowContext = {
  row: RowFacts;
  /** The signed-in user's PM id. */
  meId: string;
  paymentsRole: PaymentsRole;
  canWrite: boolean;
  /** Has this row's PM handed in the week it belongs to? */
  weekSubmitted: boolean;
};

/**
 * Your own rows lock once you hand the week in — that is what makes the
 * submission mean anything. Two exceptions matter: a row sent back has to
 * be fixable or the loop never closes, and a paid row is a closed record.
 * An admin is never locked out, because someone has to be able to undo a
 * mistake.
 */
export function canChangeRow({
  row,
  meId,
  paymentsRole,
  canWrite,
  weekSubmitted,
}: RowContext): boolean {
  if (!canWrite) return false;
  if (paymentsRole === "admin") return true;
  if (row.paid) return false;
  if (row.rejected) return row.pmId === meId;
  return row.pmId === meId && !weekSubmitted;
}

/**
 * May this person put a new row into that week?
 *
 * A PM cannot add to a week they already signed — the totals finance is
 * paying from have to be the totals that were signed for. An admin can,
 * because a payment that turns up late still has to land somewhere.
 */
export function canAddToWeek({
  paymentsRole,
  canWrite,
  weekSubmitted,
}: {
  paymentsRole: PaymentsRole;
  canWrite: boolean;
  weekSubmitted: boolean;
}): boolean {
  if (!canWrite) return false;
  if (paymentsRole === "admin") return true;
  return !weekSubmitted;
}

/**
 * Does saving this edit also clear the rejection?
 *
 * Only when the row's own PM is the one fixing it — that is the whole
 * loop, and there is no separate "resubmit" button to forget to press. An
 * admin correcting a typo on somebody else's sent-back row does not
 * quietly answer the rejection on that PM's behalf.
 */
export const editClearsRejection = ({
  row,
  meId,
}: {
  row: RowFacts;
  meId: string;
}): boolean => row.rejected && row.pmId === meId;

/** Only whoever handles the money pays a row, sends it back, or reopens a week. */
export const isPaymentsAdmin = (paymentsRole: PaymentsRole) =>
  paymentsRole === "admin";
