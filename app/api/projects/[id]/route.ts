import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { PROJECT_STAGES } from "@/app/config";

/** PATCH /api/projects/:shortId — edit details, or move the stage. */
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
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("short_id", Number(params.id))
    .single();

  if (!project) return notFound("Project not found.");

  const patch: Record<string, string | null> = {};

  // ── stage move ──
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(PROJECT_STAGES as readonly string[]).includes(status))
      return badRequest("That isn't a valid stage.");
    patch.status = status;
  }

  // ── detail edit ──
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest("Project name is required.");
    patch.name = name;
  }
  for (const field of ["address", "city", "county", "client", "type", "description"] as const) {
    if (body[field] !== undefined) patch[field] = String(body[field]).trim() || null;
  }
  if (body.startDate !== undefined) patch.start_date = body.startDate || null;

  if (Object.keys(patch).length === 0) return badRequest("Nothing to change.");

  const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
  if (error) return badRequest("Couldn't save that. Try again.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text:
      patch.status && Object.keys(patch).length === 1
        ? `${user.name} moved ${project.name} to ${patch.status}`
        : `${user.name} edited ${patch.name ?? project.name}`,
    meta: patch.status && Object.keys(patch).length === 1 ? `was ${project.status}` : null,
    project_id: project.id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
