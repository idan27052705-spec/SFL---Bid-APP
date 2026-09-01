import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { APP_ROLES, PAGES } from "@/app/config";

const PAGE_KEYS = PAGES.map((p) => p.key) as string[];

/**
 * PATCH /api/team/:id — someone's role and the pages they can open.
 * Admins only.
 *
 * The role and the page list are one decision made on one screen, so
 * they are saved together. An admin sees everything regardless of the
 * list, so the list is only meaningful for a project manager — but it is
 * still stored for an admin, so demoting someone doesn't silently hand
 * them whatever happened to be ticked years ago.
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

  if (user.appRole !== "admin")
    return forbidden("Only an admin can change what someone can access.");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Nothing to change.");

  const appRole = String(body.appRole ?? "");
  if (!(APP_ROLES as readonly string[]).includes(appRole))
    return badRequest("Pick Admin or Project manager.");

  const requested: unknown = body.pageAccess;
  if (!Array.isArray(requested)) return badRequest("Nothing to change.");

  // Only keys we know about, no duplicates. Anything else is dropped
  // rather than trusted — this list decides what a person can reach.
  const pageAccess = Array.from(new Set(requested.map(String))).filter((k) =>
    PAGE_KEYS.includes(k)
  );

  const supabase = createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, name, app_role")
    .eq("id", params.id)
    .single();
  if (!target) return notFound("That person isn't on your team.");

  /**
   * Never leave the company without an admin. Losing the last one means
   * nobody can pay a week, change a role, or undo this — and no screen
   * left could put it right.
   */
  if (target.app_role === "admin" && appRole !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .eq("app_role", "admin");

    if ((count ?? 0) <= 1)
      return badRequest(
        "That's the only admin. Make someone else an admin first, or nobody could change this back."
      );

    if (target.id === user.id)
      return badRequest(
        "You can't take away your own admin. Ask another admin to do it."
      );
  }

  // profiles_sync_role (migration 0009) keeps the RLS role and the
  // payments role in step, so this route sets the one value people see.
  const { error } = await supabase
    .from("profiles")
    .update({ app_role: appRole, page_access: pageAccess })
    .eq("id", target.id);

  if (error) return badRequest("Couldn't save that.");

  const changedRole = target.app_role !== appRole;
  const entries = [
    changedRole
      ? `${user.name} made ${target.name} ${
          appRole === "admin" ? "an admin" : "a project manager"
        }`
      : null,
    `${user.name} set ${target.name}'s access to ${
      appRole === "admin"
        ? "every page"
        : pageAccess.length
          ? pageAccess.join(", ")
          : "no pages"
    }`,
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
