import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, forbidden } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { readWeek, requirePaymentsUser, weekIsSigned } from "@/lib/paymentsServer";

/**
 * POST /api/payments/submit — hand a week in.
 *
 * The submission row IS the signature, so this only ever inserts one, and
 * only ever for the caller: you sign your own week and nobody else's, not
 * even an admin. Signing twice is not an error — the second press of a
 * button that has already worked should say yes, not scold — so an
 * existing signature comes back as a no-op.
 *
 * Taking it back is deliberately not here. That needs an admin, and it
 * lives in ./reopen-requests and ./reopen.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.canWrite) return forbidden();

  const body = await request.json().catch(() => null);
  const week = readWeek(body?.weekStart);
  if (!week) return badRequest("That isn't a week.");

  const supabase = createClient();

  if (await weekIsSigned(supabase, user.companyId, user.id, week))
    return NextResponse.json({ ok: true, weekStart: week, alreadySigned: true });

  const { data, error } = await supabase
    .from("payment_week_submissions")
    .insert({ company_id: user.companyId, pm_id: user.id, week_start: week })
    .select("submitted_at")
    .single();

  // Two clicks landing at once both find no signature and both insert; the
  // unique index settles it, and the loser has nothing to complain about.
  if (error?.code === "23505")
    return NextResponse.json({ ok: true, weekStart: week, alreadySigned: true });

  if (error || !data) return badRequest("Couldn't hand that week in. Try again.");

  return NextResponse.json({
    ok: true,
    weekStart: week,
    submittedAt: data.submitted_at,
  });
}
