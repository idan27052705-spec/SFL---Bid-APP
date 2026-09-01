import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, forbidden } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import {
  REOPEN_COLUMNS,
  asReopenRecord,
  nameMap,
  readText,
  readWeek,
  requirePaymentsUser,
  toReopenRequest,
  weekIsSigned,
} from "@/lib/paymentsServer";

/**
 * POST /api/payments/reopen-requests — ask for a signed week back.
 *
 * A signature you can take back on your own is not one, so this is the
 * only way a locked week opens: the PM asks, with a message, and whoever
 * handles the money decides. Always for the caller's own week — an admin
 * who wants a week open does not ask themselves, they use ./../reopen.
 *
 * Asking twice replaces the first ask rather than stacking up: whoever
 * reads the queue should see one line per week, the latest thing the PM
 * has to say about it, not a history of nagging. The partial unique index
 * on pending requests enforces that, so the old one goes first.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.canWrite) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const week = readWeek(body.weekStart);
  if (!week) return badRequest("That isn't a week.");

  const message = readText(body.message);
  if (!message)
    return badRequest("Say why you need the week back — it's all they decide on.");

  const supabase = createClient();

  if (!(await weekIsSigned(supabase, user.companyId, user.id, week)))
    return badRequest("You haven't handed that week in, so it's already open.");

  await supabase
    .from("payment_reopen_requests")
    .delete()
    .eq("company_id", user.companyId)
    .eq("pm_id", user.id)
    .eq("week_start", week)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("payment_reopen_requests")
    .insert({
      company_id: user.companyId,
      pm_id: user.id,
      week_start: week,
      message,
    })
    .select(REOPEN_COLUMNS)
    .single();

  if (error || !data) return badRequest("Couldn't send that request. Try again.");

  const record = asReopenRecord(data);
  const names = await nameMap(supabase, [record.pm_id]);

  return NextResponse.json({ ok: true, request: toReopenRequest(record, names) });
}
