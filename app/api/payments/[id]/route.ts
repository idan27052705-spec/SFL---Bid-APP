import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, forbidden, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { canChangeRow, editClearsRejection } from "@/lib/paymentsGuard";
import {
  ROW_COLUMNS,
  asRowRecord,
  factsOf,
  readAmount,
  readDay,
  readText,
  readWeek,
  readPaymentRow,
  requirePaymentsUser,
  weekIsSigned,
} from "@/lib/paymentsServer";

/**
 * Load the row and settle, once, whether this caller may change it.
 *
 * Both verbs below ask exactly the same question — the rule about who owns
 * a row does not care whether you are editing it or throwing it away — so
 * they ask it in the same place and get the same answer.
 */
async function openRow(id: string) {
  const auth = await requirePaymentsUser();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;

  if (!user.canWrite) return { error: forbidden() };

  const supabase = createClient();
  const { data } = await supabase
    .from("payment_rows")
    .select(ROW_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!data) return { error: notFound("That payment wasn't found.") };
  const row = asRowRecord(data);

  const signed = await weekIsSigned(supabase, row.company_id, row.pm_id, row.week_start);
  const allowed = canChangeRow({
    row: factsOf(row),
    meId: user.id,
    paymentsRole: user.paymentsRole,
    canWrite: true,
    weekSubmitted: signed,
  });

  if (!allowed)
    return {
      error: forbidden(
        row.paid_on
          ? "That payment has been paid — its record is closed."
          : row.pm_id !== user.id
            ? "That payment belongs to another project manager."
            : "You've already handed this week in. Ask for it back to change it."
      ),
    };

  return { user, supabase, row };
}

/** PATCH /api/payments/:id — change one expected payment. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const opened = await openRow(params.id);
  if ("error" in opened) return opened.error;
  const { user, supabase, row } = opened;

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const patch: Record<string, string | number | null> = {};

  if (body.weekStart !== undefined) {
    const week = readWeek(body.weekStart);
    if (!week) return badRequest("That isn't a week.");
    // Moving a row to a week its PM has already signed would slip a payment
    // in behind a signature, so only an admin may carry one across.
    if (week !== row.week_start) {
      if (user.paymentsRole !== "admin")
        return forbidden("Only whoever handles the money can move a payment to another week.");
      patch.week_start = week;
    }
  }

  if (body.date !== undefined) {
    if (body.date === null || body.date === "") patch.expected_date = null;
    else {
      const day = readDay(body.date);
      if (!day) return badRequest("That isn't a date.");
      patch.expected_date = day;
    }
  }

  if (body.projectName !== undefined) {
    const name = readText(body.projectName);
    if (!name) return badRequest("Type the project this payment is for.");
    patch.project_name = name;
  }

  // A typed project that isn't on the list keeps its name and loses the
  // link; null is how the screens say "not one of ours".
  if (body.projectId !== undefined) {
    if (!body.projectId) patch.project_id = null;
    else {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", String(body.projectId))
        .maybeSingle();
      if (!project) return notFound("Project not found.");
      patch.project_id = project.id;
    }
  }

  if (body.payTo !== undefined) patch.pay_to = readText(body.payTo) || null;

  if (body.reason !== undefined) {
    const reason = readText(body.reason);
    if (!reason) return badRequest("Say what the payment is for.");
    patch.reason = reason;
  }

  if (body.amount !== undefined) {
    const amount = readAmount(body.amount);
    if (amount === null) return badRequest("Enter an amount above zero.");
    patch.amount = amount;
  }

  if (body.pmId !== undefined) {
    const pmId = readText(body.pmId);
    if (pmId && pmId !== row.pm_id) {
      if (user.paymentsRole !== "admin")
        return forbidden("Only whoever handles the money can move a payment to another PM.");
      const { data: pm } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", pmId)
        .maybeSingle();
      if (!pm) return notFound("That project manager wasn't found.");
      patch.pm_id = pmId;
    }
  }

  /*
    Fixing a row that was sent back clears the rejection, which puts it
    straight back in the finance queue. That is the whole loop: there is no
    separate "resubmit" button to forget to press. Only the row's own PM
    answers a rejection — an admin correcting a typo on somebody else's
    sent-back row does not do it on their behalf.
  */
  if (editClearsRejection({ row: factsOf(row), meId: user.id })) {
    patch.rejected_at = null;
    patch.rejected_by = null;
    patch.rejection_reason = null;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("payment_rows")
      .update(patch)
      .eq("id", row.id);
    if (error) return badRequest("Couldn't save that. Try again.");
  }

  const updated = await readPaymentRow(supabase, row.id);
  if (!updated) return notFound("That payment wasn't found.");

  return NextResponse.json({ ok: true, row: updated });
}

/** DELETE /api/payments/:id — take one expected payment off the schedule. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const opened = await openRow(params.id);
  if ("error" in opened) return opened.error;
  const { supabase, row } = opened;

  // Proofs go with it: payment_proofs cascades on the row, but the objects
  // in the bucket are ours to clear up.
  const { data: proofs } = await supabase
    .from("payment_proofs")
    .select("storage_path")
    .eq("payment_row_id", row.id);

  const paths = (proofs ?? []).map((p) => p.storage_path as string);
  if (paths.length) await supabase.storage.from("bid-files").remove(paths);

  const { error } = await supabase.from("payment_rows").delete().eq("id", row.id);
  if (error) return badRequest("Couldn't delete that payment. Try again.");

  return NextResponse.json({ ok: true });
}
