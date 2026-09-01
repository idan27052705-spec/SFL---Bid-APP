import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { isPaymentsAdmin } from "@/lib/paymentsGuard";
import { notFinance, requirePaymentsUser } from "@/lib/paymentsServer";

/**
 * POST /api/payments/proofs/sign — hand the browser a one-time upload URL.
 *
 * Same mechanics as /api/uploads/sign, and for the same reason: files do
 * not go through this server. Vercel caps a request body at 4.5 MB, so the
 * browser uploads straight to Supabase Storage with a signed URL and only
 * tells us about it afterwards — here, that "afterwards" is the proofs
 * array on POST /api/payments/:id/paid.
 *
 * It needs its own route rather than reusing the bid one because that one
 * files everything under a project, and a payment has none. The objects
 * land in the same private bucket, under the caller's company and a
 * payments/ prefix. The browser never chooses where a file goes.
 *
 * Only whoever handles the money, because they are the only ones who ever
 * attach a proof — a PM never marks a row paid.
 */
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requirePaymentsUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!isPaymentsAdmin(user.paymentsRole)) return notFinance();

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const size = Number(body?.size ?? 0);

  if (!name) return badRequest("No file name.");
  if (!Number.isFinite(size) || size <= 0) return badRequest("That file is empty.");
  if (size > MAX_BYTES) return badRequest("Proof files must be under 25 MB.");

  // The extension comes off the typed name only — a screenshot's name is
  // whatever the paste handler invented, and the path is ours to decide.
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "") : "";
  const path = `${user.companyId}/payments/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("bid-files")
    .createSignedUploadUrl(path);

  if (error || !data) return badRequest("Couldn't start that upload.");

  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
