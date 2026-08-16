import { NextResponse } from "next/server";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/portal/files/:id — signed link to a drawing.
 *
 * A sub may only open a file that is attached to a bid they were actually
 * invited to. Checked here, every time, because the service-role client
 * has no row-level security of its own.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const sub = await getPortalSub();
  if (!sub) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const admin = createAdminClient();

  const { data: file } = await admin
    .from("files")
    .select("id, name, storage_path")
    .eq("id", params.id)
    .single();

  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Which bids is this file attached to, and was this sub invited to any?
  const { data: links } = await admin
    .from("bid_files")
    .select("bid_id")
    .eq("file_id", file.id);

  const bidIds = (links ?? []).map((l) => l.bid_id);
  if (bidIds.length === 0)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: invitation } = await admin
    .from("invitations")
    .select("id")
    .eq("sub_id", sub.id)
    .in("bid_id", bidIds)
    .limit(1)
    .maybeSingle();

  if (!invitation)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data, error } = await admin.storage
    .from("bid-files")
    .createSignedUrl(file.storage_path, 60 * 10);

  if (error || !data)
    return NextResponse.json({ error: "Couldn't open that file." }, { status: 400 });

  return NextResponse.json({ ok: true, url: data.signedUrl, name: file.name });
}
