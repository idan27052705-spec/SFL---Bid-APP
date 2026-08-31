import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, forbidden, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { canAddToWeek } from "@/lib/paymentsGuard";
import {
  ROW_COLUMNS,
  asRowRecord,
  nameMap,
  readAmount,
  readDay,
  readText,
  readWeek,
  requirePaymentsUser,
  toPaymentRow,
  weekIsSigned,
} from "@/lib/paymentsServer";

/**
 * POST /api/payments — write down one expected payment.
 *
 * The week, the company and the author are decided here, never taken from
 * the body: a PM adds to their own week, and only whoever handles the
 * money may enter a row against somebody else's name. Signing a week
 * closes it to its own PM — that is what the signature is for — but not to
 * an admin, because a payment that turns up late still has to land
 * somewhere.
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

  // Empty means "any day this week", which is an answer of its own — not a
  // blank waiting to be filled in.
  const hasDay = body.date !== undefined && body.date !== null && body.date !== "";
  const day = hasDay ? readDay(body.date) : null;
  if (hasDay && !day) return badRequest("That isn't a date.");

  const projectName = readText(body.projectName);
  if (!projectName) return badRequest("Type the project this payment is for.");

  const reason = readText(body.reason);
  if (!reason) return badRequest("Say what the payment is for.");

  const amount = readAmount(body.amount);
  if (amount === null) return badRequest("Enter an amount above zero.");

  const pmId = readText(body.pmId) || user.id;
  if (pmId !== user.id && user.paymentsRole !== "admin")
    return forbidden("You can only add payments to your own schedule.");

  const supabase = createClient();

  // RLS keeps this inside the caller's company, so a foreign id simply
  // doesn't come back rather than being written against the wrong company.
  if (pmId !== user.id) {
    const { data: pm } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", pmId)
      .maybeSingle();
    if (!pm) return notFound("That project manager wasn't found.");
  }

  // A typed project that isn't on the list keeps its name and loses the
  // link — but an id that was sent and doesn't resolve is a bug, not a
  // free-typed name, so it is refused rather than silently dropped.
  let projectId: string | null = null;
  if (body.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", String(body.projectId))
      .maybeSingle();
    if (!project) return notFound("Project not found.");
    projectId = project.id;
  }

  const signed = await weekIsSigned(supabase, user.companyId, pmId, week);
  if (!canAddToWeek({ paymentsRole: user.paymentsRole, canWrite: true, weekSubmitted: signed }))
    return forbidden(
      "You've already handed this week in. Ask for it back before adding to it."
    );

  const { data: created, error } = await supabase
    .from("payment_rows")
    .insert({
      company_id: user.companyId,
      week_start: week,
      expected_date: day,
      pm_id: pmId,
      project_id: projectId,
      project_name: projectName,
      pay_to: readText(body.payTo) || null,
      reason,
      amount,
      created_by: user.id,
    })
    .select(ROW_COLUMNS)
    .single();

  if (error || !created) return badRequest("Couldn't save that payment. Try again.");

  const record = asRowRecord(created);
  const names = await nameMap(supabase, [record.pm_id]);

  return NextResponse.json({ ok: true, row: toPaymentRow(record, names, []) });
}
