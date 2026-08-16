import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/** POST /api/settings/trades — add a trade. Trades are data, not code. */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return badRequest("Give the trade a name.");
  if (name.length > 60) return badRequest("That name is too long.");

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("trades")
    .select("id")
    .eq("company_id", user.companyId)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return badRequest(`${name} is already on the list.`);

  const { count } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("company_id", user.companyId);

  const { data, error } = await supabase
    .from("trades")
    .insert({ company_id: user.companyId, name, position: count ?? 0 })
    .select("id, name")
    .single();

  if (error) return badRequest("Couldn't add that trade.");
  return NextResponse.json({ ok: true, trade: data });
}

/** DELETE /api/settings/trades?id=… — refuses if the trade is in use. */
export async function DELETE(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return badRequest("Which trade?");

  const supabase = createClient();

  // Removing a trade that bids or subs point at would orphan them.
  const [{ count: bidCount }, { count: subCount }] = await Promise.all([
    supabase.from("bids").select("id", { count: "exact", head: true }).eq("trade_id", id),
    supabase.from("sub_trades").select("trade_id", { count: "exact", head: true }).eq("trade_id", id),
  ]);

  if ((bidCount ?? 0) > 0)
    return badRequest(
      `That trade is used by ${bidCount} bid package${bidCount === 1 ? "" : "s"}. It can't be removed.`
    );
  if ((subCount ?? 0) > 0)
    return badRequest(
      `${subCount} sub${subCount === 1 ? " is" : "s are"} listed under that trade. Change them first.`
    );

  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) return badRequest("Couldn't remove that trade.");

  return NextResponse.json({ ok: true });
}
