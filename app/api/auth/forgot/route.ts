import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wrongOrigin } from "@/lib/guard";
import { createPasswordLink, sendPasswordEmail } from "@/lib/passwordLink";

/**
 * POST /api/auth/forgot — "I've forgotten my password".
 *
 * Public, so it is written to give nothing away. The answer is the same
 * whether or not that address has an account: otherwise this page
 * becomes a way to find out who works here.
 *
 * Rate limited on the same counter the sub portal uses, keyed by IP —
 * without it this is a button that mails anybody, as often as you like.
 */

const MAX_TRIES = 8;

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  // Deliberately the same reply in every branch below.
  const same = NextResponse.json({
    ok: true,
    message:
      "If that address has an account, a link to set a new password is on its way. It expires in an hour.",
  });

  if (!/^\S+@\S+\.\S+$/.test(email)) return same;

  const admin = createAdminClient();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`forgot:${ip}`).digest("hex");

  const { data: lockedUntil } = await admin.rpc("portal_login_attempt", {
    p_key: key,
    p_max: MAX_TRIES,
  });
  if (lockedUntil)
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes and try again." },
      { status: 429 }
    );

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, company_id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile) return same;

  const link = await createPasswordLink(profile.email);
  if (!link.ok) return same;

  await sendPasswordEmail({
    kind: "password_reset",
    to: profile.email,
    companyId: profile.company_id,
    fields: {
      name: profile.name,
      email: profile.email,
      set_password_url: link.url,
    },
  });

  await admin.from("activity").insert({
    company_id: profile.company_id,
    type: "updated",
    text: `${profile.name} asked for a password reset`,
    actor_id: profile.id,
  });

  return same;
}
