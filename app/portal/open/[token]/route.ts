import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPortalToken, verifyPortalToken } from "@/lib/portalToken";

/**
 * GET /portal/open/:token — the link in an invitation email.
 *
 * It does NOT sign anyone in. Idan's call, and the right one: an email can
 * be forwarded, left open on a shared phone, or sitting in an inbox
 * someone else reads. The link only says WHICH bid you're heading for —
 * the access code is what proves who you are.
 *
 * So we remember the intended bid in a short-lived cookie and send them
 * to the normal sign-in screen with their email filled in. After they
 * enter their code they land straight on that bid.
 */
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const parts = readPortalToken(params.token);
  if (!parts) return NextResponse.redirect(new URL("/portal", request.url));

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, bids(short_id), subs(id, email, session_epoch, status)")
    .eq("id", parts.invitationId)
    .single();

  if (!invitation) return NextResponse.redirect(new URL("/portal", request.url));

  const sub = invitation.subs as unknown as {
    id: string;
    email: string | null;
    session_epoch: number;
    status: string;
  };

  if (!sub || sub.status !== "Active")
    return NextResponse.redirect(new URL("/portal", request.url));

  // A regenerated access code kills every link ever emailed to them.
  if (!verifyPortalToken(params.token, sub.session_epoch ?? 1))
    return NextResponse.redirect(new URL("/portal?expired=1", request.url));

  const bid = invitation.bids as unknown as { short_id: number };

  // Remember where they were going, for after they sign in.
  cookies().set("sfl_pending", `${invitation.id}:${bid.short_id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });

  const url = new URL("/portal", request.url);
  if (sub.email) url.searchParams.set("email", sub.email);
  return NextResponse.redirect(url);
}
