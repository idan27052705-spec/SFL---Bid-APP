import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { fileKind } from "@/lib/format";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per file

/** POST /api/projects/:shortId/files — upload a drawing, photo or video. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const supabase = createClient();

  // RLS already scopes this to the user's company.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("short_id", Number(params.id))
    .single();

  if (!project) return notFound("Project not found.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file received.");
  if (file.size === 0) return badRequest("That file is empty.");
  if (file.size > MAX_BYTES)
    return badRequest("Files must be under 50 MB. Split large plan sets.");

  // Path is namespaced by company then project — never by anything the
  // browser supplies, and the original filename is never used as a path.
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safe = `${crypto.randomUUID()}${ext ? "." + ext : ""}`;
  const path = `${user.companyId}/projects/${project.id}/${safe}`;

  const { error: upErr } = await supabase.storage
    .from("bid-files")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (upErr) return badRequest("Upload failed. Try again.");

  const { data, error } = await supabase
    .from("files")
    .insert({
      company_id: user.companyId,
      project_id: project.id,
      name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || null,
      kind: fileKind(file.type, file.name),
      uploaded_by: user.id,
    })
    .select("id, name, size_bytes, kind, created_at")
    .single();

  if (error) {
    // Don't leave an orphan object behind.
    await supabase.storage.from("bid-files").remove([path]);
    return badRequest("Couldn't save the file record. Try again.");
  }

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} uploaded ${file.name} — ${project.name}`,
    project_id: project.id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, file: data });
}
