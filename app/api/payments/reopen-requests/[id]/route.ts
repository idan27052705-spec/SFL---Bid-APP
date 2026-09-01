import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import {
  REOPEN_COLUMNS,
  asReopenRecord,
  nameMap,
  notFinance,
  requirePaymentsUser,
  toReopenRequest,
} from "@/lib/paymentsServer";

/**
 * PATCH /api/payments/reopen-requests/:id — decide one ask.
 *
 * Approving is the one thing that clears a submission: the week drops back
 * to Draft for that PM, who edits it and signs it again, so the report is
 * never in a half-state where it is neither handed in nor being worked on.
 * Declining leaves the signature standing and keeps the ask on the record,
 * with a name against the decision.
 *
 * The two writes cannot be one — there is no transaction across PostgREST
 * calls — so the signature goes first. A week that reopened without the
 * request being marked is recoverable by looking at the queue; a request
 * marked approved over a week that never opened is a lie nobody can see.
 * If the second write fails, the response says so rather than reporting a
 * clean success.
 */
export async function PATCH(
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
  if (typeof body?.approved !== "boolean")
    return badRequest("Say whether it's approved or declined.");
  const approved: boolean = body.approved;

  const supabase = createClient();

  const { data: found } = await supabase
    .from("payment_reopen_requests")
    .select("id, company_id, pm_id, week_start, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!found) return notFound("That request wasn't found.");
  if (found.status !== "pending")
    return badRequest(`That request was already ${found.status}.`);

  if (approved) {
    const { error: unsignError } = await supabase
      .from("payment_week_submissions")
      .delete()
      .eq("company_id", found.company_id)
      .eq("pm_id", found.pm_id)
      .eq("week_start", found.week_start);

    if (unsignError)
      return badRequest("Couldn't reopen that week. Nothing was changed.");
  }

  const { data, error } = await supabase
    .from("payment_reopen_requests")
    .update({
      status: approved ? "approved" : "declined",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", found.id)
    .select(REOPEN_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        ok: false,
        // Only true when the first write already went through.
        weekReopened: approved,
        error: approved
          ? "The week was reopened, but the request is still showing as pending. Decline-and-retry, or resolve it again."
          : "Couldn't record that decision. Try again.",
      },
      { status: 500 }
    );
  }

  const record = asReopenRecord(data);
  const names = await nameMap(supabase, [record.pm_id, record.resolved_by]);

  return NextResponse.json({
    ok: true,
    request: toReopenRequest(record, names),
    weekReopened: approved,
  });
}
