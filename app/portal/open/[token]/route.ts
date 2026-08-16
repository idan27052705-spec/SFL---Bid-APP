import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPortalToken, verifyPortalToken } from "@/lib/portalToken";
import { setPortalSession } from "@/lib/portalSession";

/**
 * GET /portal/open/:token — the one-tap link from an invitation email.
 *
 * Signs the sub in, stamps the bid as viewed, and drops them straight on
 * the bid. A stale link (code regenerated since) just lands on the normal
 * sign-in screen rather than showing an error page.
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
    .select("id, status, viewed_at, bid_id, sub_id, bids(short_id, project_id, trades(name)), subs(id, session_epoch, status, company_name)")
    .eq("id", parts.invitationId)
    .single();

  if (!invitation) return NextResponse.redirect(new URL("/portal", request.url));

  const sub = invitation.subs as unknown as {
    id: string;
    session_epoch: number;
    status: string;
    company_name: string;
  };

  if (!sub || sub.status !== "Active")
    return NextResponse.redirect(new URL("/portal", request.url));

  // Signature must match the sub's CURRENT epoch — a regenerated code
  // kills every link ever emailed to them.
  if (!verifyPortalToken(params.token, sub.session_epoch ?? 1))
    return NextResponse.redirect(new URL("/portal?expired=1", request.url));

  setPortalSession(sub.id, sub.session_epoch ?? 1);

  // View tracking — the thing the office actually watches.
  if (!invitation.viewed_at) {
    const bid = invitation.bids as unknown as {
      short_id: number;
      project_id: string;
      trades: { name: string } | null;
    };

    await admin
      .from("invitations")
      .update({
        viewed_at: new Date().toISOString(),
        status: invitation.status === "Sent" || invitation.status === "No Response"
          ? "Viewed"
          : invitation.status,
      })
      .eq("id", invitation.id);

    const { data: bidRow } = await admin
      .from("bids")
      .select("company_id")
      .eq("id", invitation.bid_id)
      .single();

    if (bidRow) {
      await admin.from("activity").insert({
        company_id: bidRow.company_id,
        type: "viewed",
        text: `${sub.company_name} opened the bid`,
        meta: bid?.trades?.name ?? null,
        project_id: bid?.project_id ?? null,
        bid_id: invitation.bid_id,
      });
    }
  }

  const bid = invitation.bids as unknown as { short_id: number };
  return NextResponse.redirect(new URL(`/portal/bids/${bid.short_id}`, request.url));
}
