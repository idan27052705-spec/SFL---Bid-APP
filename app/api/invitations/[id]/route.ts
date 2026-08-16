import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * DELETE /api/invitations/:id — pull a sub off a package.
 * Refused once they've priced it, so a real quote can't quietly vanish.
 */
export async function DELETE(
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

  const { data: iv } = await supabase
    .from("invitations")
    .select("id, bid_id, status, subs(company_name), responses(id), bids(project_id, trades(name))")
    .eq("id", params.id)
    .single();

  if (!iv) return notFound("Invitation not found.");

  const responses = iv.responses as unknown as unknown[] | null;
  if (Array.isArray(responses) ? responses.length > 0 : !!responses)
    return badRequest(
      "That sub already sent a price. Deny the bid instead of removing them, so the record stays."
    );

  const sub = iv.subs as unknown as { company_name: string };
  const bid = iv.bids as unknown as {
    project_id: string;
    trades: { name: string } | null;
  };

  const { error } = await supabase.from("invitations").delete().eq("id", iv.id);
  if (error) return badRequest("Couldn't remove that invitation.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${sub.company_name} removed from ${bid.trades?.name ?? "the package"} — reminders stopped`,
    project_id: bid.project_id,
    bid_id: iv.bid_id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
