import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { generateAccessCode, hashAccessCode } from "@/lib/accessCode";

/**
 * POST /api/subs/:shortId/code — issue a new access code.
 * The old code stops working immediately, and bumping session_epoch ends
 * any portal session already signed in with it.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const supabase = createClient();

  const { data: sub } = await supabase
    .from("subs")
    .select("id, company_name, session_epoch")
    .eq("short_id", Number(params.id))
    .single();

  if (!sub) return notFound("Sub not found.");

  const code = generateAccessCode();

  const { error } = await supabase
    .from("subs")
    .update({
      access_code_hash: hashAccessCode(code, sub.id),
      code_issued_at: new Date().toISOString(),
      session_epoch: (sub.session_epoch ?? 1) + 1,
    })
    .eq("id", sub.id);

  if (error) return badRequest("Couldn't issue a new code. Try again.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} regenerated the access code — ${sub.company_name}`,
    meta: "old code invalidated, sessions ended",
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, code });
}
