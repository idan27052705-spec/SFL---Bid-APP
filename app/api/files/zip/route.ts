import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/files/zip — download several files as one archive.
 *
 * Browsers block a burst of programmatic downloads, so "download all"
 * has to be a single file. RLS on `files` means the query only ever
 * returns rows from the caller's own company; anything else in the id
 * list is silently dropped rather than erroring, because a partial
 * archive is more useful than a failure.
 */
const MAX_FILES = 40;
const MAX_TOTAL = 250 * 1024 * 1024; // 250 MB — keep it out of memory trouble

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, MAX_FILES) : [];
  const name = String(body?.name ?? "files").replace(/[^\w \-—.]/g, "").slice(0, 60) || "files";

  if (ids.length === 0) return badRequest("Pick at least one file.");

  const supabase = createClient();

  const { data: files } = await supabase
    .from("files")
    .select("id, name, storage_path, size_bytes")
    .in("id", ids);

  if (!files || files.length === 0) return badRequest("Those files weren't found.");

  const total = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  if (total > MAX_TOTAL)
    return badRequest(
      "That's over 250 MB in one go. Select fewer files, or download the big ones individually."
    );

  const zip = new JSZip();
  const used = new Set<string>();

  for (const f of files) {
    const { data, error } = await supabase.storage
      .from("bid-files")
      .download(f.storage_path);

    if (error || !data) continue;

    // Two subs can attach "quote.pdf" — don't let one overwrite the other.
    let entry = f.name;
    if (used.has(entry)) {
      const dot = entry.lastIndexOf(".");
      const stem = dot > 0 ? entry.slice(0, dot) : entry;
      const ext = dot > 0 ? entry.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`)) n += 1;
      entry = `${stem} (${n})${ext}`;
    }
    used.add(entry);

    zip.file(entry, await data.arrayBuffer());
  }

  if (used.size === 0) return badRequest("Couldn't read those files.");

  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}.zip"`,
      "Content-Length": String(archive.byteLength),
    },
  });
}
