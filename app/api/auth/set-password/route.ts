import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/auth/set-password — redeem a one-time link and set a password.
 *
 * The token is the proof: it came from an email only that person can
 * read, and Supabase invalidates it the moment it is used. Nothing here
 * trusts the email address in the request body — the token decides whose
 * password is being changed.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!token) return badRequest("That link is missing its code. Ask for a new one.");
  if (password.length < 8)
    return badRequest("Use at least 8 characters.");

  const supabase = createClient();

  // Redeems the link and signs them in, in one step.
  const { data, error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: token,
  });

  if (error || !data.user)
    return badRequest(
      "That link has expired or has already been used. Ask for a new one.",
      410
    );

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError)
    return badRequest(updateError.message || "Couldn't set that password.");

  return NextResponse.json({ ok: true });
}
