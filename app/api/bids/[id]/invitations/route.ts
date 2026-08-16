import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { sendEmail, renderTemplate, siteUrl } from "@/lib/email";
import { makePortalToken } from "@/lib/portalToken";
import { issueAccessCode, revealCode } from "@/lib/accessCode";
import { formatDate } from "@/lib/format";
import { COMPANY } from "@/app/config";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/bids/:shortId/invitations — invite subs to price a package.
 *
 * Sends a real email to each one. A sub who has never been given an access
 * code gets one issued now, and the plain code comes back in the response
 * so the office can read it out if the sub calls.
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
  const subIds: string[] = Array.isArray(body?.subIds) ? body.subIds : [];
  if (subIds.length === 0) return badRequest("Pick at least one sub.");

  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "id, short_id, title, due_date, status, project_id, projects(name, city), trades(name)"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) return notFound("Bid not found.");
  if (bid.status === "Awarded")
    return badRequest("This package is already awarded.");

  const project = bid.projects as unknown as { name: string; city: string | null } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  // RLS keeps this to the caller's own company, so a foreign sub id
  // simply doesn't come back.
  const { data: subs } = await supabase
    .from("subs")
    .select("id, company_name, contact_name, email, access_code_hash, access_code_enc, session_epoch")
    .in("id", subIds);

  if (!subs || subs.length === 0) return badRequest("Those subs weren't found.");

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("kind", "invite")
    .single();

  if (!template) return badRequest("The invitation template is missing.");

  const sent: string[] = [];
  const failed: { company: string; reason: string }[] = [];
  const issuedCodes: { company: string; code: string }[] = [];

  for (const sub of subs) {
    if (!sub.email) {
      failed.push({ company: sub.company_name, reason: "no email address on file" });
      continue;
    }

    // Already invited to this package? Don't create a duplicate.
    const { data: existing } = await supabase
      .from("invitations")
      .select("id")
      .eq("bid_id", bid.id)
      .eq("sub_id", sub.id)
      .maybeSingle();

    let invitationId = existing?.id;

    if (!invitationId) {
      const { data: created, error } = await supabase
        .from("invitations")
        .insert({
          company_id: user.companyId,
          bid_id: bid.id,
          sub_id: sub.id,
          status: "Sent",
        })
        .select("id")
        .single();

      if (error || !created) {
        failed.push({ company: sub.company_name, reason: "couldn't be saved" });
        continue;
      }
      invitationId = created.id;
    }

    // Every email carries the sub's own access code. If they have none, or
    // theirs predates encrypted storage and can't be read back, issue a
    // fresh one now so the email is never sent without a usable code.
    let accessCode = revealCode(sub.access_code_enc);
    if (!accessCode) {
      const issued = issueAccessCode(sub.id);
      await supabase.from("subs").update(issued.columns).eq("id", sub.id);
      accessCode = issued.code;
      issuedCodes.push({ company: sub.company_name, code: accessCode });
    }

    const token = makePortalToken(invitationId, sub.session_epoch ?? 1);
    const link = `${siteUrl()}/portal/open/${token}`;

    const fields = {
      contact: sub.contact_name || sub.company_name,
      sub_company: sub.company_name,
      company_name: COMPANY.name,
      company_phone: COMPANY.phone,
      project: project?.name ?? "",
      city: project?.city ?? "",
      trade: trade?.name ?? "",
      bid_title: bid.title,
      due_date: formatDate(bid.due_date),
      portal_url: link,
      access_code: accessCode,
    };

    const result = await sendEmail({
      to: sub.email,
      subject: renderTemplate(template.subject, fields),
      text: renderTemplate(template.body, fields),
      portalUrl: link,
    });

    if (!result.ok) {
      failed.push({ company: sub.company_name, reason: result.error });
      continue;
    }

    await supabase
      .from("invitations")
      .update({ status: "Sent", sent_at: new Date().toISOString() })
      .eq("id", invitationId);

    sent.push(sub.company_name);

    await supabase.from("activity").insert({
      company_id: user.companyId,
      type: "sent",
      text: `Bid sent to ${sub.company_name} — ${trade?.name ?? ""}`,
      meta: "email",
      project_id: bid.project_id,
      bid_id: bid.id,
      actor_id: user.id,
    });
  }

  // The package is live the moment the first invitation goes out.
  if (sent.length > 0 && bid.status === "Draft") {
    await supabase.from("bids").update({ status: "Out for Bid" }).eq("id", bid.id);
  }

  return NextResponse.json({ ok: true, sent, failed, issuedCodes });
}
