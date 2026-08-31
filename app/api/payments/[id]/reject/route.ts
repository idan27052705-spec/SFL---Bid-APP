import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import {
  readText,
  readPaymentRow,
  notFinance,
  requirePaymentsUser,
} from "@/lib/paymentsServer";

/**
 * POST /api/payments/:id/reject — send one payment back to its PM.
 *
 * The reason is the whole point: a row that comes back without one leaves
 * the PM guessing at what to change, so it is required rather than
 * optional. A paid row cannot be sent back — the money has gone, and the
 * table refuses to hold both facts at once anyway.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!isPaymentsAdmin(user.paymentsRole)) return notFinance();

  const body = await request.json().catch(() => null);
  const reason = readText(body?.reason);
  if (!reason) return badRequest("Say what needs fixing, or the PM is guessing.");

  const supabase = createClient();

  const { data: row } = await supabase
    .from("payment_rows")
    .select("id, paid_on")
    .eq("id", params.id)
    .maybeSingle();

  if (!row) return notFound("That payment wasn't found.");
  if (row.paid_on)
    return badRequest("That payment has already gone out — it can't be sent back.");

  const { error } = await supabase
    .from("payment_rows")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: user.id,
      rejection_reason: reason,
    })
    .eq("id", row.id);

  if (error) return badRequest("Couldn't send that back. Try again.");

  const saved = await readPaymentRow(supabase, row.id);
  if (!saved) return notFound("That payment wasn't found.");

  return NextResponse.json({ ok: true, row: saved });
}
