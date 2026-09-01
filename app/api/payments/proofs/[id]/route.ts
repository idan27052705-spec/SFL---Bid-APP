import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import { notFinance, requirePaymentsUser } from "@/lib/paymentsServer";

/**
 * GET /api/payments/proofs/:id — hand back a short-lived signed URL.
 *
 * The bucket is private, so this is the only way to read a proof. Mirrors
 * /api/files/:id: RLS on payment_proofs already guarantees the row belongs
 * to the caller's company, so there is nothing else to check.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;

  const supabase = createClient();

  const { data: proof } = await supabase
    .from("payment_proofs")
    .select("id, name, storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!proof) return notFound("That file wasn't found.");

  const { data, error } = await supabase.storage
    .from("bid-files")
    .createSignedUrl(proof.storage_path, 60 * 10, { download: false });

  if (error || !data) return badRequest("Couldn't open that file.");

  return NextResponse.json({ ok: true, url: data.signedUrl, name: proof.name });
}

/**
 * DELETE /api/payments/proofs/:id — unattach one piece of evidence.
 *
 * Whoever handles the money attached it, so only they can take it off — a
 * PM cannot quietly remove the confirmation that a payment against their
 * name went out. The object goes with the row; a proof nobody can reach is
 * just a bill for storage.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!isPaymentsAdmin(user.paymentsRole)) return notFinance();

  const supabase = createClient();

  const { data: proof } = await supabase
    .from("payment_proofs")
    .select("id, storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!proof) return notFound("That file wasn't found.");

  await supabase.storage.from("bid-files").remove([proof.storage_path]);

  const { error } = await supabase
    .from("payment_proofs")
    .delete()
    .eq("id", proof.id);

  if (error) return badRequest("Couldn't remove that file.");

  return NextResponse.json({ ok: true });
}
