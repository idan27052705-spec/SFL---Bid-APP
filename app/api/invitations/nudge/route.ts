import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { sendEmail, renderTemplate, siteUrl } from "@/lib/email";
import { makePortalToken } from "@/lib/portalToken";
import { issueAccessCode, revealCode } from "@/lib/accessCode";
import { formatDate } from "@/lib/format";
import { COMPANY } from "@/app/config";

/**
 * POST /api/invitations/nudge — "Send again to all".
 *
 * Chases everyone who was sent a package at least `days` ago and still
 * hasn't priced it. Skips anyone who already answered, declined, or
 * whose package is awarded — nagging those people is the fastest way to
 * lose a good sub.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const days = Number(body?.days ?? 2);
  if (!Number.isFinite(days) || days < 0 || days > 365)
    return badRequest("Bad window.");

  const supabase = createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("kind", "reminder")
    .single();
  if (!template) return badRequest("The reminder template is missing.");

  const { data: rows } = await supabase
    .from("invitations")
    .select(
      "id, status, sent_at, reminders, bid_id, sub_id, subs(id, company_name, contact_name, email, access_code_enc, session_epoch), bids(short_id, title, due_date, status, project_id, projects(name, city), trades(name)), responses(id)"
    );

  const cutoff = Date.now() - days * 86400000;

  const pool = (rows ?? []).filter((r) => {
    const responses = r.responses as unknown as unknown[] | unknown | null;
    const hasPrice = Array.isArray(responses) ? responses.length > 0 : !!responses;
    const bid = r.bids as unknown as { status: string } | null;

    if (hasPrice) return false;
    if (r.status === "Denied") return false;
    if (bid?.status === "Awarded") return false;
    if (!r.sent_at) return false;
    return new Date(r.sent_at).getTime() <= cutoff;
  });

  if (pool.length === 0)
    return NextResponse.json({ ok: true, sent: 0, failed: [] });

  const failed: string[] = [];
  let sent = 0;

  for (const r of pool) {
    const sub = r.subs as unknown as {
      id: string;
      company_name: string;
      contact_name: string | null;
      email: string | null;
      access_code_enc: string | null;
      session_epoch: number;
    };
    const bid = r.bids as unknown as {
      short_id: number;
      title: string;
      due_date: string | null;
      project_id: string;
      projects: { name: string; city: string | null } | null;
      trades: { name: string } | null;
    };

    if (!sub?.email) {
      failed.push(sub?.company_name ?? "unknown");
      continue;
    }

    let code = revealCode(sub.access_code_enc);
    if (!code) {
      const issued = issueAccessCode(sub.id);
      await supabase.from("subs").update(issued.columns).eq("id", sub.id);
      code = issued.code;
    }

    const link = `${siteUrl()}/portal/open/${makePortalToken(r.id, sub.session_epoch ?? 1)}`;
    const fields = {
      contact: sub.contact_name || sub.company_name,
      sub_company: sub.company_name,
      company_name: COMPANY.name,
      company_phone: COMPANY.phone,
      project: bid.projects?.name ?? "",
      city: bid.projects?.city ?? "",
      trade: bid.trades?.name ?? "",
      bid_title: bid.title,
      due_date: formatDate(bid.due_date),
      portal_url: link,
      access_code: code,
    };

    const result = await sendEmail({
      to: sub.email,
      subject: renderTemplate(template.subject, fields),
      text: renderTemplate(template.body, fields),
      portalUrl: link,
    });

    if (!result.ok) {
      failed.push(sub.company_name);
      continue;
    }

    await supabase
      .from("invitations")
      .update({
        reminders: (r.reminders ?? 0) + 1,
        last_reminder_at: new Date().toISOString(),
        status: r.status === "No Response" || r.status === "Expired" ? "Sent" : r.status,
      })
      .eq("id", r.id);

    sent += 1;
  }

  if (sent > 0) {
    await supabase.from("activity").insert({
      company_id: user.companyId,
      type: "sent",
      text: `Reminder sent to ${sent} sub${sent === 1 ? "" : "s"}${days ? ` not contacted in ${days}+ days` : ""}`,
      meta: `${user.name} · email`,
      actor_id: user.id,
    });
  }

  return NextResponse.json({ ok: true, sent, failed });
}
