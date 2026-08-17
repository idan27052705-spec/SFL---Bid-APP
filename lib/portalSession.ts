import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sub portal sessions.
 *
 * Subs have no Supabase account — they sign in with their email and their
 * 6-digit access code. The session is a signed cookie holding the sub id
 * and the session epoch that was current when they signed in.
 *
 * Because the epoch is baked into the cookie, regenerating a sub's access
 * code signs them out everywhere immediately: their cookie's epoch no
 * longer matches the one on their row.
 */

const COOKIE = "sfl_sub";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — these are field guys, not banks

const secret = () => {
  const s = process.env.PORTAL_TOKEN_SECRET;
  if (!s) throw new Error("PORTAL_TOKEN_SECRET is not set");
  return s;
};

const sign = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");

/**
 * `preview` marks a staff "Preview as sub" session. It looks like a real
 * session to the sub-facing code, but it must never leave a footprint:
 * no "opened the bid", no prices, no change requests. Without the mark
 * the office looking at a bid would show up as the sub having opened it.
 */
export function setPortalSession(
  subId: string,
  epoch: number,
  options?: { preview?: boolean }
) {
  const value = options?.preview ? `${subId}:${epoch}:p` : `${subId}:${epoch}`;
  cookies().set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearPortalSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

/** The signed-in sub, or null. Re-checks the epoch against the database. */
export async function getPortalSub() {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;

  const value = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  const a = Buffer.from(signature);
  const b = Buffer.from(sign(value));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [subId, epochText, mark] = value.split(":");
  if (!subId) return null;
  const isPreview = mark === "p";

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subs")
    .select("id, short_id, company_name, contact_name, email, phone, city, status, session_epoch, company_id")
    .eq("id", subId)
    .single();

  if (!sub) return null;
  if (sub.status !== "Active") return null;
  // Code regenerated since they signed in → session is dead.
  if (String(sub.session_epoch ?? 1) !== epochText) return null;

  return { ...sub, isPreview };
}
