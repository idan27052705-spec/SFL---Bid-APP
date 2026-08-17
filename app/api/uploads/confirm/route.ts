import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { fileKind } from "@/lib/format";

/**
 * POST /api/uploads/confirm — record a file the browser just uploaded.
 *
 * The storage path must sit inside this company's own folder, and must
 * actually exist in the bucket. Otherwise a crafted request could invent
 * a row pointing at someone else's object.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const path = String(body?.path ?? "");
  const name = String(body?.name ?? "").trim();
  const size = Number(body?.size ?? 0);
  const mime = String(body?.mime ?? "") || null;
  const projectShortId = Number(body?.projectShortId);
  const bidShortId = body?.bidShortId ? Number(body.bidShortId) : null;

  if (!path.startsWith(`${user.companyId}/`))
    return badRequest("That upload doesn't belong to your company.");
  if (!name) return badRequest("No file name.");

  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("short_id", projectShortId)
    .single();
  if (!project) return notFound("Project not found.");

  // Prove the object is really there before writing a row about it.
  const folder = path.slice(0, path.lastIndexOf("/"));
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed } = await supabase.storage
    .from("bid-files")
    .list(folder, { search: filename, limit: 1 });

  if (!listed || listed.length === 0)
    return badRequest("That upload didn't finish. Try again.");

  const { data: row, error } = await supabase
    .from("files")
    .insert({
      company_id: user.companyId,
      project_id: project.id,
      name,
      storage_path: path,
      size_bytes: size || listed[0].metadata?.size || null,
      mime_type: mime,
      kind: fileKind(mime, name),
      uploaded_by: user.id,
    })
    .select("id, name, kind, size_bytes")
    .single();

  if (error || !row) return badRequest("Couldn't save the file record.");

  let bidId: string | null = null;
  if (bidShortId) {
    const { data: bid } = await supabase
      .from("bids")
      .select("id")
      .eq("short_id", bidShortId)
      .single();
    if (bid) {
      bidId = bid.id;
      const { count } = await supabase
        .from("bid_files")
        .select("file_id", { count: "exact", head: true })
        .eq("bid_id", bid.id);
      await supabase
        .from("bid_files")
        .insert({ bid_id: bid.id, file_id: row.id, position: count ?? 0 });
    }
  }

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} uploaded ${name} — ${project.name}`,
    project_id: project.id,
    bid_id: bidId,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, file: row });
}
