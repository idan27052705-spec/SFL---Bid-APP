import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";

/**
 * GET /api/files/:id — hand back a short-lived signed URL.
 * The bucket is private, so this is the only way to read a file.
 * RLS on `files` guarantees the row belongs to the caller's company.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const supabase = createClient();

  const { data: file } = await supabase
    .from("files")
    .select("id, name, storage_path")
    .eq("id", params.id)
    .single();

  if (!file) return notFound("File not found.");

  const { data, error } = await supabase.storage
    .from("bid-files")
    .createSignedUrl(file.storage_path, 60 * 10, { download: false });

  if (error || !data) return badRequest("Couldn't open that file.");

  return NextResponse.json({ ok: true, url: data.signedUrl, name: file.name });
}

/** DELETE /api/files/:id — remove the object and its row. Owner + staff only. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role === "viewer") return forbidden();

  const supabase = createClient();

  const { data: file } = await supabase
    .from("files")
    .select("id, name, storage_path, project_id")
    .eq("id", params.id)
    .single();

  if (!file) return notFound("File not found.");

  await supabase.storage.from("bid-files").remove([file.storage_path]);

  const { error } = await supabase.from("files").delete().eq("id", file.id);
  if (error) return badRequest("Couldn't delete that file.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} deleted ${file.name}`,
    project_id: file.project_id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
