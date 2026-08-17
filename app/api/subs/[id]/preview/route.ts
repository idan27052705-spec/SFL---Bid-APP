import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { setPortalSession } from "@/lib/portalSession";

/**
 * POST /api/subs/:shortId/preview — "Preview as sub".
 *
 * Opens the portal in that sub's session so the office can see exactly
 * what the sub sees. Owner and staff only, and it writes an activity
 * line every time — impersonation that isn't recorded is a liability.
 *
 * Note this replaces the current portal cookie. The staff session is a
 * separate cookie and is untouched, so the office user stays signed in
 * on the staff side.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

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

  setPortalSession(sub.id, sub.session_epoch ?? 1, { preview: true });

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} previewed the portal as ${sub.company_name}`,
    meta: "staff preview · audited",
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
