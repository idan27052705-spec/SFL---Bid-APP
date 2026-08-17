import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { REMINDER_CADENCES } from "@/app/config";
import { advanceProjectStage } from "@/lib/stage";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/bids/save — create or update a bid package.
 *
 * One endpoint for both, because the builder screen is the same either
 * way: send `bidShortId` to update, `projectShortId` to create.
 *
 * Line items and attached files are replaced wholesale — the builder
 * always sends the complete list, which keeps ordering and deletions
 * simple and avoids a diffing dance.
 */

type Item = {
  description?: string;
  detail?: string;
  qty?: string | number;
  unit?: string;
};

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const title = String(body.title ?? "").trim();
  const tradeId = String(body.tradeId ?? "").trim();
  const dueDate = body.dueDate ? String(body.dueDate) : null;
  const scope = String(body.scope ?? "").trim();
  const cadence = String(body.cadence ?? "Every 2 days");
  const items: Item[] = Array.isArray(body.items) ? body.items : [];
  const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];

  if (!tradeId) return badRequest("Pick a trade for this package.");
  if (!title) return badRequest("Give the package a title.");
  if (!REMINDER_CADENCES.includes(cadence as never))
    return badRequest("That reminder setting isn't valid.");

  const supabase = createClient();

  // The trade must belong to this company — RLS makes a foreign one invisible.
  const { data: trade } = await supabase
    .from("trades")
    .select("id, name")
    .eq("id", tradeId)
    .single();
  if (!trade) return badRequest("That trade no longer exists.");

  let bidId: string;
  let projectId: string;
  let shortId: number;
  let created = false;

  if (body.bidShortId) {
    const { data: bid } = await supabase
      .from("bids")
      .select("id, short_id, project_id, status")
      .eq("short_id", Number(body.bidShortId))
      .single();

    if (!bid) return notFound("Bid not found.");

    // Awarded packages are history — don't let the scope shift underneath.
    if (bid.status === "Awarded")
      return badRequest("This package is awarded. Awarded bids can't be edited.");

    const { error } = await supabase
      .from("bids")
      .update({
        trade_id: tradeId,
        title,
        due_date: dueDate,
        scope: scope || null,
        cadence,
      })
      .eq("id", bid.id);

    if (error) return badRequest("Couldn't save the package. Try again.");

    bidId = bid.id;
    projectId = bid.project_id;
    shortId = bid.short_id;
  } else {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("short_id", Number(body.projectShortId))
      .single();

    if (!project) return notFound("Project not found.");

    const { data: bid, error } = await supabase
      .from("bids")
      .insert({
        company_id: user.companyId,
        project_id: project.id,
        trade_id: tradeId,
        title,
        due_date: dueDate,
        scope: scope || null,
        cadence,
        status: "Draft",
        created_by: user.id,
      })
      .select("id, short_id")
      .single();

    if (error || !bid) return badRequest("Couldn't create the package. Try again.");

    bidId = bid.id;
    projectId = project.id;
    shortId = bid.short_id;
    created = true;
  }

  // ── line items (replace) ──────────────────────────────────────────
  await supabase.from("bid_line_items").delete().eq("bid_id", bidId);

  const rows = items
    .map((i, index) => ({
      bid_id: bidId,
      description: String(i.description ?? "").trim(),
      detail: String(i.detail ?? "").trim() || null,
      qty: i.qty === "" || i.qty == null ? null : Number(i.qty),
      unit: String(i.unit ?? "lot").trim() || "lot",
      position: index,
    }))
    .filter((r) => r.description.length > 0);

  if (rows.length) await supabase.from("bid_line_items").insert(rows);

  // ── attached files (replace) ──────────────────────────────────────
  await supabase.from("bid_files").delete().eq("bid_id", bidId);

  if (fileIds.length) {
    // Only files the caller can see — RLS filters to their company.
    const { data: allowed } = await supabase
      .from("files")
      .select("id")
      .in("id", fileIds);

    const links = (allowed ?? []).map((f, index) => ({
      bid_id: bidId,
      file_id: f.id,
      position: index,
    }));
    if (links.length) await supabase.from("bid_files").insert(links);
  }

  if (created) await advanceProjectStage(supabase, projectId, "Building bids");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: created ? "created" : "updated",
    text: `${user.name} ${created ? "created" : "updated"} bid package — ${trade.name}`,
    meta: created ? "draft" : null,
    project_id: projectId,
    bid_id: bidId,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, bid: { id: bidId, short_id: shortId }, created });
}
