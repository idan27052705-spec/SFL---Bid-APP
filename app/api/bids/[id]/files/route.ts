import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { fileKind } from "@/lib/format";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * POST /api/bids/:shortId/files — upload straight onto a bid package.
 * Files land on the project too, so they stay available to other trades,
 * and are linked to this bid via bid_files.
 */
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

  const supabase = createClient();
  const { data: bid } = await supabase
    .from("bids")
    .select("id, project_id, trades(name)")
    .eq("short_id", Number(params.id))
    .single();
  if (!bid) return notFound("Bid not found.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file received.");
  if (file.size === 0) return badRequest("That file is empty.");
  if (file.size > MAX_BYTES) return badRequest("Files must be under 50 MB.");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${user.companyId}/projects/${bid.project_id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

  const { error: upErr } = await supabase.storage
    .from("bid-files")
    .upload(path, file, { contentType: file.type || undefined });
  if (upErr) return badRequest("Upload failed. Try again.");

  const { data: row, error } = await supabase
    .from("files")
    .insert({
      company_id: user.companyId,
      project_id: bid.project_id,
      name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || null,
      kind: fileKind(file.type, file.name),
      uploaded_by: user.id,
    })
    .select("id, name, kind")
    .single();

  if (error || !row) {
    await supabase.storage.from("bid-files").remove([path]);
    return badRequest("Couldn't save the file record.");
  }

  const { count } = await supabase
    .from("bid_files")
    .select("file_id", { count: "exact", head: true })
    .eq("bid_id", bid.id);

  await supabase
    .from("bid_files")
    .insert({ bid_id: bid.id, file_id: row.id, position: count ?? 0 });

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} attached ${file.name} — ${(bid.trades as unknown as { name: string } | null)?.name ?? ""}`,
    meta: "invited subs see it in the portal",
    project_id: bid.project_id,
    bid_id: bid.id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, file: row });
}
