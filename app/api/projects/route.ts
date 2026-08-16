import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";

/** POST /api/projects — create a project. Owner + staff only. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("Project name is required.");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: user.companyId,
      name,
      address: String(body.address ?? "").trim() || null,
      city: String(body.city ?? "").trim() || null,
      county: String(body.county ?? "").trim() || null,
      client: String(body.client ?? "").trim() || null,
      type: String(body.type ?? "").trim() || null,
      start_date: body.startDate || null,
      description: String(body.description ?? "").trim() || null,
      status: "Bidding",
      created_by: user.id,
    })
    .select("id, short_id, name")
    .single();

  if (error) return badRequest("Couldn't create the project. Try again.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "created",
    text: `${user.name} created project — ${data.name}`,
    project_id: data.id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, project: data });
}
