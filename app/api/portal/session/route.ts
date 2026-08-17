import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAccessCode } from "@/lib/accessCode";
import { setPortalSession, clearPortalSession } from "@/lib/portalSession";
import { cookies } from "next/headers";
import { STR, pickLang } from "@/lib/portalStrings";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/portal/session — sub sign-in with email (or phone) + access code.
 *
 * A 6-digit code is a million possibilities, which a script can walk
 * through. The real protection is the limiter, and it counts in the
 * database: this runs on serverless, where an in-memory counter starts
 * empty on every cold start and stops nothing.
 *
 * The key is hashed so no email address is written to that table.
 */

const MAX_TRIES = 8;

const limiterKey = (ip: string, identifier: string) =>
  createHash("sha256").update(`${ip}:${identifier}`).digest("hex");

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const body = await request.json().catch(() => null);
  const t = STR[pickLang(body?.lang)];

  const identifier = String(body?.identifier ?? "").trim().toLowerCase();
  const code = String(body?.code ?? "").trim();

  if (!identifier || !code)
    return NextResponse.json({ error: t.badLogin }, { status: 400 });

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const admin = createAdminClient();
  const key = limiterKey(ip, identifier);

  const { data: lockedUntil } = await admin.rpc("portal_login_attempt", {
    p_key: key,
    p_max: MAX_TRIES,
  });

  if (lockedUntil) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(lockedUntil as string).getTime() - Date.now()) / 60000)
    );
    return NextResponse.json(
      { error: t.tooMany.replace("{minutes}", String(minutes)) },
      { status: 429 }
    );
  }

  const digits = identifier.replace(/\D/g, "");

  // Match on email, or on phone once punctuation is stripped.
  const { data: candidates } = await admin
    .from("subs")
    .select("id, email, phone, status, session_epoch, access_code_hash")
    .or(`email.ilike.${identifier}${digits.length >= 7 ? `,phone.ilike.%${digits.slice(-7)}%` : ""}`);

  const sub = (candidates ?? []).find(
    (s) =>
      s.status === "Active" && verifyAccessCode(code, s.id, s.access_code_hash)
  );

  // Deliberately the same message whether the email or the code was wrong.
  if (!sub) return NextResponse.json({ error: t.badLogin }, { status: 401 });

  clearPortalSession();
  setPortalSession(sub.id, sub.session_epoch ?? 1);
  await admin.rpc("portal_login_clear", { p_key: key });

  await admin
    .from("subs")
    .update({ code_last_used_at: new Date().toISOString() })
    .eq("id", sub.id);

  // If they arrived from an emailed link, drop them on that bid — but only
  // if the remembered invitation actually belongs to THIS sub.
  let redirect = "/portal/bids";
  const pending = cookies().get("sfl_pending")?.value;
  if (pending) {
    const [invitationId, bidShortId] = pending.split(":");
    const { data: invitation } = await admin
      .from("invitations")
      .select("id")
      .eq("id", invitationId)
      .eq("sub_id", sub.id)
      .maybeSingle();
    if (invitation) redirect = `/portal/bids/${bidShortId}`;
    cookies().set("sfl_pending", "", { path: "/", maxAge: 0 });
  }

  return NextResponse.json({ ok: true, redirect });
}
