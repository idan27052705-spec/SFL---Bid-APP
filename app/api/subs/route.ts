import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { generateAccessCode, hashAccessCode } from "@/lib/accessCode";

/** POST /api/subs — add a subcontractor and issue their access code. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const companyName = String(body.companyName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const tradeIds: string[] = Array.isArray(body.tradeIds) ? body.tradeIds : [];

  if (!companyName) return badRequest("Company name is required.");
  if (!email) return badRequest("Email is required — it's how they sign in.");
  if (!/^\S+@\S+\.\S+$/.test(email))
    return badRequest("That doesn't look like a valid email address.");
  if (tradeIds.length === 0)
    return badRequest("Pick at least one trade, so they get the right bids.");

  const supabase = createClient();

  // Same email twice inside one company is almost always a mistake.
  const { data: existing } = await supabase
    .from("subs")
    .select("id, company_name")
    .eq("company_id", user.companyId)
    .ilike("email", email)
    .maybeSingle();

  if (existing)
    return badRequest(`${existing.company_name} already uses that email address.`);

  const { data: sub, error } = await supabase
    .from("subs")
    .insert({
      company_id: user.companyId,
      company_name: companyName,
      contact_name: String(body.contactName ?? "").trim() || null,
      email,
      phone: String(body.phone ?? "").trim() || null,
      city: String(body.city ?? "").trim() || null,
      status: "Active",
    })
    .select("id, short_id, company_name")
    .single();

  if (error) return badRequest("Couldn't add that sub. Try again.");

  // Code needs the sub id as salt, so it's set right after insert.
  const code = generateAccessCode();
  await supabase
    .from("subs")
    .update({
      access_code_hash: hashAccessCode(code, sub.id),
      code_issued_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  const rows = tradeIds.map((trade_id) => ({ sub_id: sub.id, trade_id }));
  if (rows.length) await supabase.from("sub_trades").insert(rows);

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "created",
    text: `${user.name} added sub — ${sub.company_name}`,
    meta: "access code issued",
    actor_id: user.id,
  });

  // The only time the plain code is ever returned.
  return NextResponse.json({ ok: true, sub, code });
}
