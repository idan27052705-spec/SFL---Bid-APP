import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { REMINDER_CADENCES } from "@/app/config";

/** PATCH /api/bids/:shortId/cadence — how often to chase quiet subs. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const cadence = String(body?.cadence ?? "");
  if (!REMINDER_CADENCES.includes(cadence as never))
    return badRequest("That reminder setting isn't valid.");

  const supabase = createClient();
  const { data: bid } = await supabase
    .from("bids")
    .select("id, project_id, trades(name)")
    .eq("short_id", Number(params.id))
    .single();
  if (!bid) return notFound("Bid not found.");

  const { error } = await supabase.from("bids").update({ cadence }).eq("id", bid.id);
  if (error) return badRequest("Couldn't save that.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `Reminder cadence set to ${cadence} — ${(bid.trades as unknown as { name: string } | null)?.name ?? ""}`,
    meta: user.name,
    project_id: bid.project_id,
    bid_id: bid.id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, cadence });
}
