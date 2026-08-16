import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/invitations/:id/comments — internal note on a sub's bid.
 *
 * These are for the office only. Subs have no route that reads the
 * comments table, and RLS scopes it to the company — a sub could not
 * see one even if a route existed.
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

  const body = await request.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) return badRequest("Write something first.");

  const supabase = createClient();

  const { data: iv } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", params.id)
    .single();
  if (!iv) return notFound("Invitation not found.");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      invitation_id: iv.id,
      author_id: user.id,
      author_name: user.name,
      body: text.slice(0, 2000),
    })
    .select("id, author_name, body, created_at")
    .single();

  if (error) return badRequest("Couldn't save that note.");

  return NextResponse.json({ ok: true, comment: data });
}
