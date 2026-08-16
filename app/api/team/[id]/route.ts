import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { ROLES } from "@/app/config";

/** PATCH /api/team/:id — change someone's role. Owners only. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role !== "owner")
    return forbidden("Only an owner can change roles.");

  const body = await request.json().catch(() => null);
  const role = String(body?.role ?? "");
  if (!ROLES.includes(role as never)) return badRequest("Unknown role.");

  const supabase = createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", params.id)
    .single();
  if (!target) return notFound("That person isn't on your team.");

  // Don't let the last owner demote themselves and lock everyone out.
  if (target.role === "owner" && role !== "owner") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1)
      return badRequest(
        "That's the only owner. Make someone else an owner first, or you'd lock everyone out."
      );
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", target.id);
  if (error) return badRequest("Couldn't change that role.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} changed ${target.name}'s role to ${role}`,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
