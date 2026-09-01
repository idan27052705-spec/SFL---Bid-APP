import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { ROLES } from "@/app/config";

/** The two payments roles. An owner is an admin whatever this says. */
const PAYMENTS_ROLES = ["admin", "pm"];

/**
 * PATCH /api/team/:id — change what someone is allowed to do. Owners only.
 *
 * Two roles live on a profile and they answer different questions: `role`
 * is what they can do in the app, `payments_role` is who they are to the
 * payment schedule. They are set from the same table on the same screen,
 * so they come through the same route — either alone, or both at once.
 */
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

  const wantsRole = body?.role !== undefined;
  const wantsPaymentsRole = body?.paymentsRole !== undefined;
  if (!wantsRole && !wantsPaymentsRole) return badRequest("Nothing to change.");

  const role = String(body?.role ?? "");
  if (wantsRole && !ROLES.includes(role as never))
    return badRequest("Unknown role.");

  const paymentsRole = String(body?.paymentsRole ?? "");
  if (wantsPaymentsRole && !PAYMENTS_ROLES.includes(paymentsRole))
    return badRequest("Unknown payments role.");

  const supabase = createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", params.id)
    .single();
  if (!target) return notFound("That person isn't on your team.");

  // Don't let the last owner demote themselves and lock everyone out.
  if (wantsRole && target.role === "owner" && role !== "owner") {
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

  const patch: Record<string, string> = {};
  if (wantsRole) patch.role = role;
  if (wantsPaymentsRole) patch.payments_role = paymentsRole;

  const { error } = await supabase.from("profiles").update(patch).eq("id", target.id);
  if (error) return badRequest("Couldn't change that role.");

  /*
    One line per thing that actually changed. "Changed their role to staff
    and their payments role to admin" is two decisions, and the log is read
    to find out when one of them was made.
  */
  const entries = [
    wantsRole ? `${user.name} changed ${target.name}'s role to ${role}` : null,
    wantsPaymentsRole
      ? `${user.name} made ${target.name} ${
          paymentsRole === "admin"
            ? "a payments admin"
            : "a project manager on the payment schedule"
        }`
      : null,
  ].filter((text): text is string => text !== null);

  await supabase.from("activity").insert(
    entries.map((text) => ({
      company_id: user.companyId,
      type: "updated",
      text,
      actor_id: user.id,
    }))
  );

  return NextResponse.json({ ok: true });
}
