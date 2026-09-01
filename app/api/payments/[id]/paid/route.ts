import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import {
  readDay,
  readMethod,
  readText,
  readPaymentRow,
  notFinance,
  requirePaymentsUser,
} from "@/lib/paymentsServer";

/** A proof as the mark-paid dialog hands it over, once its bytes are stored. */
type ProofInput = {
  name?: unknown;
  storagePath?: unknown;
  sizeBytes?: unknown;
  mimeType?: unknown;
};

/**
 * POST /api/payments/:id/paid — record that the money went out.
 *
 * Only whoever handles the money, and paid_on is the calendar day it left
 * — typed on the form, not the moment this button was pressed. A row that
 * was sent back and has since been paid anyway stops being sent back: the
 * table forbids being both at once, so the rejection is cleared in the
 * same write rather than in a second one that could fail on its own.
 *
 * The proof files are already in storage by the time this runs (see
 * ./../../proofs/sign) — this only writes the rows that say so.
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
  if (!body) return badRequest("Bad request.");

  const paidOn = readDay(body.paidOn);
  if (!paidOn) return badRequest("Say which day the money went out.");

  const method = readMethod(body.method);
  if (method === undefined) return badRequest("That isn't a payment method we record.");

  const proofs: ProofInput[] = Array.isArray(body.proofs) ? body.proofs : [];

  const supabase = createClient();

  const { data: row } = await supabase
    .from("payment_rows")
    .select("id, company_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!row) return notFound("That payment wasn't found.");

  // Every proof must sit inside this company's own folder, or a crafted
  // request could point a row at somebody else's object.
  const attachments = [];
  for (const proof of proofs) {
    const name = readText(proof.name);
    const path = String(proof.storagePath ?? "");
    if (!name || !path) return badRequest("A proof arrived with no name or file.");
    if (!path.startsWith(`${user.companyId}/`))
      return badRequest("That upload doesn't belong to your company.");

    const size = Number(proof.sizeBytes);
    attachments.push({
      company_id: row.company_id,
      payment_row_id: row.id,
      name,
      storage_path: path,
      size_bytes: Number.isFinite(size) && size > 0 ? size : null,
      mime_type: readText(proof.mimeType) || null,
      uploaded_by: user.id,
    });
  }

  const { error } = await supabase
    .from("payment_rows")
    .update({
      paid_on: paidOn,
      paid_by: user.id,
      paid_method: method,
      paid_reference: readText(body.reference) || null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    })
    .eq("id", row.id);

  if (error) return badRequest("Couldn't mark that as paid. Try again.");

  if (attachments.length) {
    const { error: proofError } = await supabase
      .from("payment_proofs")
      .insert(attachments);
    // The payment is recorded either way — saying it failed would be worse
    // than saying the evidence didn't attach.
    if (proofError) {
      const saved = await readPaymentRow(supabase, row.id);
      return NextResponse.json(
        {
          ok: false,
          row: saved,
          error: "Marked as paid, but the proof files couldn't be attached.",
        },
        { status: 500 }
      );
    }
  }

  const saved = await readPaymentRow(supabase, row.id);
  if (!saved) return notFound("That payment wasn't found.");

  return NextResponse.json({ ok: true, row: saved });
}
