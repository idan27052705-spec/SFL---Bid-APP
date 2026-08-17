import { NextResponse } from "next/server";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/portal/bids/:shortId/decline — "I can't bid this one".
 *
 * Worth as much as a price: it stops the reminders and tells the office
 * to stop waiting. Same scoping rules as the response route — everything
 * is looked up through the signed-in sub's own invitation.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const sub = await getPortalSub();
  if (!sub) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  // A staff "Preview as sub" session is strictly look-only — the office
  // must not be able to price a job on a sub's behalf by accident.
  if (sub.isPreview)
    return NextResponse.json(
      { error: "This is a preview. Nothing you do here is saved." },
      { status: 403 }
    );

  const body = await request.json().catch(() => null);
  const t = STR[pickLang(body?.lang)];

  const reason = String(body?.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: t.reasonRequired }, { status: 400 });

  const admin = createAdminClient();

  const { data: bid } = await admin
    .from("bids")
    .select("id, company_id, project_id, trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, status")
    .eq("bid_id", bid.id)
    .eq("sub_id", sub.id)
    .single();

  if (!invitation)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (invitation.status === "Received")
    return NextResponse.json(
      { error: "You already sent a price for this one." },
      { status: 400 }
    );

  await admin
    .from("invitations")
    .update({ status: "Denied", decline_reason: reason.slice(0, 300) })
    .eq("id", invitation.id);

  const trade = bid.trades as unknown as { name: string } | null;

  await admin.from("activity").insert([
    {
      company_id: bid.company_id,
      type: "denied",
      text: `${sub.company_name} can't bid ${trade?.name ?? ""} — "${reason.slice(0, 120)}"`,
      meta: "via portal",
      project_id: bid.project_id,
      bid_id: bid.id,
    },
    {
      company_id: bid.company_id,
      type: "updated",
      text: `Reminders stopped for ${sub.company_name} — declined`,
      meta: "automatic",
      project_id: bid.project_id,
      bid_id: bid.id,
    },
  ]);

  return NextResponse.json({ ok: true, message: t.declinedOk });
}
