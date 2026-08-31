import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import {
  notFinance,
  readText,
  readWeek,
  requirePaymentsUser,
} from "@/lib/paymentsServer";

/**
 * POST /api/payments/reopen — open a signed week without being asked.
 *
 * The request queue is the PM's way in; this is the admin's. Someone has
 * to be able to undo a mistake — a week signed a day early, a row that was
 * obviously wrong — without waiting for the PM to notice and ask. Deleting
 * the submission is the whole operation: the row IS the signature.
 *
 * A week that was not signed comes back as a no-op rather than an error;
 * the point of the button is that the week ends up open.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!isPaymentsAdmin(user.paymentsRole)) return notFinance();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const week = readWeek(body.weekStart);
  if (!week) return badRequest("That isn't a week.");

  const pmId = readText(body.pmId);
  if (!pmId) return badRequest("Say whose week to reopen.");

  const supabase = createClient();

  // RLS scopes this to the caller's company, so a foreign id doesn't come
  // back rather than reopening a week in somebody else's company.
  const { data: pm } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", pmId)
    .maybeSingle();
  if (!pm) return notFound("That project manager wasn't found.");

  const { data: deleted, error } = await supabase
    .from("payment_week_submissions")
    .delete()
    .eq("company_id", user.companyId)
    .eq("pm_id", pmId)
    .eq("week_start", week)
    .select("id");

  if (error) return badRequest("Couldn't reopen that week. Try again.");

  return NextResponse.json({
    ok: true,
    weekStart: week,
    pmId,
    reopened: (deleted ?? []).length > 0,
  });
}
