import { NextResponse } from "next/server";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { wrongOrigin } from "@/lib/guard";
import { fileKind } from "@/lib/format";

/**
 * Sub-side upload, in two steps, for the same reason as the staff one:
 * Vercel caps a request body at 4.5 MB, and a photo of a handwritten
 * quote taken on a phone is easily more than that.
 *
 * POST { name, size, bidShortId }        → signed upload URL
 * POST { path, name, size, mime, ... }   → records the file
 *
 * The invitation is the permission on both steps: a sub can only ever
 * attach to a package they were actually invited to.
 */
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const sub = await getPortalSub();
  if (!sub) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const admin = createAdminClient();

  const { data: bid } = await admin
    .from("bids")
    .select("id, company_id")
    .eq("short_id", Number(body.bidShortId))
    .single();
  if (!bid) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: invitation } = await admin
    .from("invitations")
    .select("id")
    .eq("bid_id", bid.id)
    .eq("sub_id", sub.id)
    .single();
  if (!invitation) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // ── step 2: record a finished upload ──
  if (body.path) {
    const path = String(body.path);
    const expected = `${bid.company_id}/responses/${invitation.id}/`;
    if (!path.startsWith(expected))
      return NextResponse.json({ error: "Bad upload path." }, { status: 400 });

    const { data: row, error } = await admin
      .from("files")
      .insert({
        company_id: bid.company_id,
        bid_id: bid.id,
        name: String(body.name ?? "quote"),
        storage_path: path,
        size_bytes: Number(body.size) || null,
        mime_type: String(body.mime ?? "") || null,
        kind: fileKind(String(body.mime ?? ""), String(body.name ?? "")),
      })
      .select("id, name")
      .single();

    if (error || !row)
      return NextResponse.json({ error: "Couldn't save that file." }, { status: 400 });

    return NextResponse.json({ ok: true, file: row });
  }

  // ── step 1: sign ──
  const name = String(body.name ?? "").trim();
  const size = Number(body.size ?? 0);
  if (!name) return NextResponse.json({ error: "No file name." }, { status: 400 });
  if (size > MAX_BYTES)
    return NextResponse.json({ error: "That file is over 50 MB." }, { status: 400 });

  const ext = name.includes(".") ? name.split(".").pop() : "";
  const path = `${bid.company_id}/responses/${invitation.id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

  const { data, error } = await admin.storage
    .from("bid-files")
    .createSignedUploadUrl(path);

  if (error || !data)
    return NextResponse.json({ error: "Couldn't start that upload." }, { status: 400 });

  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
