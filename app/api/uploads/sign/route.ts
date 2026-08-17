import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/uploads/sign — hand the browser a one-time upload URL.
 *
 * Files do NOT go through this server. Vercel caps a request body at
 * 4.5 MB, so a 20 MB plan set posted to an API route dies with a 413
 * before any of our code runs. Instead the browser uploads straight to
 * Supabase Storage with a signed URL, and only tells us about it
 * afterwards (see ./confirm).
 *
 * The path is still built here, from the caller's own company and
 * project — the browser never chooses where a file lands.
 */
const MAX_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const projectShortId = Number(body?.projectShortId);
  const name = String(body?.name ?? "").trim();
  const size = Number(body?.size ?? 0);

  if (!name) return badRequest("No file name.");
  if (!Number.isFinite(size) || size <= 0) return badRequest("That file is empty.");
  if (size > MAX_BYTES) return badRequest("Files must be under 200 MB.");

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("short_id", projectShortId)
    .single();

  if (!project) return notFound("Project not found.");

  const ext = name.includes(".") ? name.split(".").pop() : "";
  const path = `${user.companyId}/projects/${project.id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

  const { data, error } = await supabase.storage
    .from("bid-files")
    .createSignedUploadUrl(path);

  if (error || !data) return badRequest("Couldn't start that upload.");

  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
