import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/change-requests/:id — approve or decline a sub's request to
 * change their own details.
 *
 * Subs can ask, they can't edit. Nothing on the sub record moves until
 * someone in the office approves it here.
 */
const FIELD_MAP: Record<string, string> = {
  "Company name": "company_name",
  "Contact name": "contact_name",
  Email: "email",
  Phone: "phone",
  City: "city",
};

export async function POST(
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
  const approve = body?.approve === true;

  const supabase = createClient();

  const { data: cr } = await supabase
    .from("change_requests")
    .select("id, sub_id, field, value, status, subs(company_name)")
    .eq("id", params.id)
    .single();

  if (!cr) return notFound("Request not found.");
  if (cr.status !== "Pending") return badRequest("That request was already handled.");

  if (approve) {
    const column = FIELD_MAP[cr.field];
    if (!column) return badRequest("That field can't be changed here.");

    const { error } = await supabase
      .from("subs")
      .update({ [column]: cr.value })
      .eq("id", cr.sub_id);
    if (error) return badRequest("Couldn't apply that change.");
  }

  await supabase
    .from("change_requests")
    .update({
      status: approve ? "Approved" : "Declined",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", cr.id);

  const sub = cr.subs as unknown as { company_name: string } | null;

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${approve ? "Approved" : "Declined"} profile change — ${sub?.company_name ?? ""} · ${cr.field}`,
    meta: `${user.name}${approve ? ` · now "${cr.value}"` : ""}`,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
