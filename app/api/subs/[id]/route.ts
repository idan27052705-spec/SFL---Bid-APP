import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/** PATCH /api/subs/:shortId — edit a sub's details, trades or status. */
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
  if (!body) return badRequest("Bad request.");

  const supabase = createClient();
  const { data: sub } = await supabase
    .from("subs")
    .select("id, company_name")
    .eq("short_id", Number(params.id))
    .single();

  if (!sub) return notFound("Sub not found.");

  const patch: Record<string, string | null> = {};

  if (body.companyName !== undefined) {
    const name = String(body.companyName).trim();
    if (!name) return badRequest("Company name is required.");
    patch.company_name = name;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) return badRequest("Email is required — it's how they sign in.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return badRequest("That doesn't look like a valid email address.");

    // Two subs sharing an email would make portal sign-in ambiguous.
    const { data: clash } = await supabase
      .from("subs")
      .select("id, company_name")
      .ilike("email", email)
      .neq("id", sub.id)
      .maybeSingle();
    if (clash) return badRequest(`${clash.company_name} already uses that email.`);

    patch.email = email;
  }

  if (body.contactName !== undefined) patch.contact_name = String(body.contactName).trim() || null;
  if (body.phone !== undefined) patch.phone = String(body.phone).trim() || null;
  if (body.city !== undefined) patch.city = String(body.city).trim() || null;

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["Active", "Inactive"].includes(status)) return badRequest("Unknown status.");
    patch.status = status;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("subs").update(patch).eq("id", sub.id);
    if (error) return badRequest("Couldn't save that. Try again.");
  }

  // Trades are replaced wholesale — the form always sends the full set.
  if (Array.isArray(body.tradeIds)) {
    if (body.tradeIds.length === 0)
      return badRequest("Pick at least one trade, so they get the right bids.");

    const { data: allowed } = await supabase
      .from("trades")
      .select("id")
      .in("id", body.tradeIds);

    await supabase.from("sub_trades").delete().eq("sub_id", sub.id);
    const rows = (allowed ?? []).map((t) => ({ sub_id: sub.id, trade_id: t.id }));
    if (rows.length) await supabase.from("sub_trades").insert(rows);
  }

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} edited sub — ${patch.company_name ?? sub.company_name}`,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
