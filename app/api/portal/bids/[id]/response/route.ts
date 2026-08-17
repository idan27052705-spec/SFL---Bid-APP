import { NextResponse } from "next/server";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { money } from "@/lib/format";
import { wrongOrigin } from "@/lib/guard";
import { advanceProjectStage } from "@/lib/stage";

/**
 * POST /api/portal/bids/:shortId/response — the sub sends their price.
 *
 * This runs with the service-role key because subs have no database
 * account, so EVERY read and write is explicitly scoped to the signed-in
 * sub's own invitation. A sub can never reach another sub's bid by
 * changing the number in the URL.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const sub = await getPortalSub();
  if (!sub) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const lang = pickLang(String(form.get("lang") ?? ""));
  const t = STR[lang];

  const rawPrice = String(form.get("price") ?? "").replace(/[^\d.]/g, "");
  const price = Number(rawPrice);
  if (!rawPrice || !Number.isFinite(price) || price <= 0)
    return NextResponse.json({ error: t.priceRequired }, { status: 400 });

  const admin = createAdminClient();

  const { data: bid } = await admin
    .from("bids")
    .select("id, company_id, status, project_id, trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // The invitation is the permission check: no invitation, no access.
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, status")
    .eq("bid_id", bid.id)
    .eq("sub_id", sub.id)
    .single();

  if (!invitation)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (bid.status === "Awarded")
    return NextResponse.json(
      { error: "This package has already been awarded." },
      { status: 400 }
    );

  // The attachment was uploaded separately (see /api/portal/uploads) and
  // only its id arrives here. Check it really belongs to this bid before
  // pinning it to the response.
  let fileId: string | null = null;
  const claimed = String(form.get("fileId") ?? "");
  if (claimed) {
    const { data: file } = await admin
      .from("files")
      .select("id")
      .eq("id", claimed)
      .eq("bid_id", bid.id)
      .maybeSingle();
    fileId = file?.id ?? null;
  }

  // One quote per invitation — re-submitting replaces the old one.
  const { error } = await admin.from("responses").upsert(
    {
      invitation_id: invitation.id,
      price,
      lead_time: String(form.get("lead") ?? "").trim() || null,
      exclusions: String(form.get("exclusions") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
      file_id: fileId,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "invitation_id" }
  );

  if (error)
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 400 });

  await admin
    .from("invitations")
    .update({ status: "Received" })
    .eq("id", invitation.id);

  // First price in flips the package so the office knows to look.
  if (bid.status === "Out for Bid")
    await admin.from("bids").update({ status: "Responses In" }).eq("id", bid.id);

  await advanceProjectStage(admin, bid.project_id, "Review");

  const trade = bid.trades as unknown as { name: string } | null;

  await admin.from("activity").insert([
    {
      company_id: bid.company_id,
      type: "received",
      text: `${sub.company_name} submitted ${money(price)} — ${trade?.name ?? ""}`,
      meta: "via portal",
      project_id: bid.project_id,
      bid_id: bid.id,
    },
    {
      company_id: bid.company_id,
      type: "updated",
      text: `Reminders stopped for ${sub.company_name} — price received`,
      meta: "automatic",
      project_id: bid.project_id,
      bid_id: bid.id,
    },
  ]);

  return NextResponse.json({ ok: true, message: t.sentOk });
}
