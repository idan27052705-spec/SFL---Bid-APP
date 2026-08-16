import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";

/**
 * POST /api/invitations/:id/deny — rule a sub's price out.
 *
 * Deliberately keeps the response row: the price they quoted stays on
 * the record with a reason next to it. Removing the invitation would
 * erase the history, which is exactly what you don't want later.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return badRequest("Give a reason — it's what you'll read later.");

  const supabase = createClient();

  const { data: iv } = await supabase
    .from("invitations")
    .select("id, status, bid_id, subs(company_name), bids(project_id, status, trades(name))")
    .eq("id", params.id)
    .single();

  if (!iv) return notFound("Invitation not found.");

  const bid = iv.bids as unknown as {
    project_id: string;
    status: string;
    trades: { name: string } | null;
  };

  if (bid.status === "Awarded")
    return badRequest("This package is already awarded.");

  const sub = iv.subs as unknown as { company_name: string };

  const { error } = await supabase
    .from("invitations")
    .update({ status: "Denied", decline_reason: reason.slice(0, 300) })
    .eq("id", iv.id);

  if (error) return badRequest("Couldn't save that. Try again.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "denied",
    text: `${sub.company_name} ruled out on ${bid.trades?.name ?? "the package"} — "${reason.slice(0, 120)}"`,
    meta: `${user.name} · reminders stopped`,
    project_id: bid.project_id,
    bid_id: iv.bid_id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
