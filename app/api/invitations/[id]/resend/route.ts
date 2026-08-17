import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { sendEmail, renderTemplate, siteUrl } from "@/lib/email";
import { makePortalToken } from "@/lib/portalToken";
import { formatDate } from "@/lib/format";
import { issueAccessCode, revealCode } from "@/lib/accessCode";
import { getCompany } from "@/lib/company";
import { wrongOrigin } from "@/lib/guard";

/** POST /api/invitations/:id/resend — nudge one sub by email. */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const company = await getCompany(user.companyId);

  if (user.role === "viewer") return forbidden();

  const supabase = createClient();

  const { data: iv } = await supabase
    .from("invitations")
    .select(
      "id, status, reminders, bid_id, sub_id, subs(id, company_name, contact_name, email, access_code_enc, session_epoch), bids(short_id, title, due_date, status, project_id, projects(name, city), trades(name))"
    )
    .eq("id", params.id)
    .single();

  if (!iv) return notFound("Invitation not found.");

  const sub = iv.subs as unknown as {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    access_code_enc: string | null;
    session_epoch: number;
  };
  const bid = iv.bids as unknown as {
    short_id: number;
    title: string;
    due_date: string | null;
    status: string;
    project_id: string;
    projects: { name: string; city: string | null } | null;
    trades: { name: string } | null;
  };

  if (!sub.email) return badRequest(`${sub.company_name} has no email address on file.`);
  if (iv.status === "Received")
    return badRequest(`${sub.company_name} already sent a price.`);
  if (iv.status === "Denied")
    return badRequest(`${sub.company_name} said they can't bid this one.`);
  if (bid.status === "Awarded") return badRequest("This package is already awarded.");

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("kind", "reminder")
    .single();

  if (!template) return badRequest("The reminder template is missing.");

  const link = `${siteUrl()}/portal/open/${makePortalToken(iv.id, sub.session_epoch ?? 1)}`;

  // Reminders repeat the sub's own code, so a lost email is never a blocker.
  let accessCode = revealCode(sub.access_code_enc);
  if (!accessCode) {
    const issued = issueAccessCode(sub.id);
    await supabase.from("subs").update(issued.columns).eq("id", sub.id);
    accessCode = issued.code;
  }

  const fields = {
    contact: sub.contact_name || sub.company_name,
    sub_company: sub.company_name,
    company_name: company.name,
    company_phone: company.phone,
    project: bid.projects?.name ?? "",
    city: bid.projects?.city ?? "",
    trade: bid.trades?.name ?? "",
    bid_title: bid.title,
    due_date: formatDate(bid.due_date),
    portal_url: link,
    access_code: accessCode,
  };

  const result = await sendEmail({
      companyId: user.companyId,
    to: sub.email,
    subject: renderTemplate(template.subject, fields),
    text: renderTemplate(template.body, fields),
    portalUrl: link,
  });

  if (!result.ok) return badRequest("The email didn't go out. Try again.");

  await supabase
    .from("invitations")
    .update({
      reminders: (iv.reminders ?? 0) + 1,
      last_reminder_at: new Date().toISOString(),
      status: iv.status === "No Response" || iv.status === "Expired" ? "Sent" : iv.status,
    })
    .eq("id", iv.id);

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "sent",
    text: `Reminder sent to ${sub.company_name} — ${bid.trades?.name ?? ""}`,
    meta: "manual · email",
    project_id: bid.project_id,
    bid_id: iv.bid_id,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
