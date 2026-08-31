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

export type EditContext = {
  row: PaymentRow;
  /** The signed-in user's PM id. */
  meId: string;
  isOwner: boolean;
  canWrite: boolean;
  /** Has this row's PM handed in the week it belongs to? */
  weekSubmitted: boolean;
};

/**
 * Your own rows lock once you hand the week in — that is what makes the
 * submission mean anything. Two exceptions matter: a row sent back has to
 * be fixable or the loop never closes, and a paid row is a closed record.
 * An owner is never locked out, because someone has to be able to undo a
 * mistake.
 */
export function canEditRow({
  row,
  meId,
  isOwner,
  canWrite,
  weekSubmitted,
}: EditContext): boolean {
  if (!canWrite) return false;
  if (isOwner) return true;
  if (row.paidAt) return false;
  if (row.rejectedAt) return row.pmId === meId;
  return row.pmId === meId && !weekSubmitted;
}
