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
 * A 6-digit code is only a million possibilities, so the real protection is
 * this limiter, not the code's length. It's per server instance and resets
 * on deploy — good enough to stop a script, and it's backed up by the fact
 * that a wrong guess reveals nothing about which half was wrong.
 */

const attempts = new Map<string, { count: number; first: number }>();
const WINDOW = 60_000;
const MAX = 8;

function rateLimited(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX;
}

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
  if (rateLimited(`${ip}:${identifier}`))
    return NextResponse.json({ error: t.tooMany }, { status: 429 });

  const admin = createAdminClient();
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
