import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate, siteUrl } from "@/lib/email";
import { formatDate } from "@/lib/format";
import { COMPANY } from "@/app/config";
import InviteClient, { type InviteSub } from "./InviteClient";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function InvitePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canWrite(user)) redirect(`/bids/${params.id}`);

  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select("id, short_id, title, due_date, status, trade_id, projects(name, city), trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();
  if (bid.status === "Awarded") redirect(`/bids/${bid.short_id}`);

  const project = bid.projects as unknown as { name: string; city: string | null } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  const [{ data: subs }, { data: invited }, { data: template }] = await Promise.all([
    supabase
      .from("subs")
      .select("id, company_name, contact_name, email, city, status, sub_trades(trade_id)")
      .eq("status", "Active")
      .order("company_name"),
    supabase.from("invitations").select("sub_id").eq("bid_id", bid.id),
    supabase.from("email_templates").select("subject, body").eq("kind", "invite").single(),
  ]);

  const invitedIds = new Set((invited ?? []).map((i) => i.sub_id));

  // Only subs that actually do this trade — the design filters on it.
  const candidates: InviteSub[] = (subs ?? [])
    .filter((s) => {
      const links = (s.sub_trades ?? []) as unknown as { trade_id: string }[];
      return links.some((l) => l.trade_id === bid.trade_id);
    })
    .map((s) => ({
      id: s.id,
      company: s.company_name,
      contact: s.contact_name ?? "",
      city: s.city ?? "",
      email: s.email,
      already: invitedIds.has(s.id),
      stat: invitedIds.has(s.id) ? "Already invited" : !s.email ? "No email on file" : "Available",
    }));

  const fields = {
    contact: "[their contact]",
    sub_company: "[their company]",
    company_name: COMPANY.name,
    company_phone: COMPANY.phone,
    project: project?.name ?? "",
    city: project?.city ?? "",
    trade: trade?.name ?? "",
    bid_title: bid.title,
    due_date: formatDate(bid.due_date),
    portal_url: `${siteUrl()}/portal`,
    access_code: "[their code]",
  };

  const preview = {
    subject: renderTemplate(template?.subject ?? "", fields),
    email: renderTemplate(template?.body ?? "", fields),
    sms: renderTemplate(
      `${COMPANY.name}: bid request for ${trade?.name ?? ""} at ${project?.name ?? ""}. Due {due_date}. Open {portal_url} — code [their code]. Questions? ${COMPANY.phone}`,
      fields
    ),
  };

  return (
    <>
      <header
        className="pagehead"
        style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link className="btn btn-ghost" href={`/bids/${bid.short_id}`} style={{ paddingLeft: 0 }}>
          ← {trade?.name}
        </Link>
        <h1 style={{ fontSize: 30, margin: "4px 0 0" }}>Invite subs</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          {project?.name} · {trade?.name} · due {formatDate(bid.due_date)}
        </div>
      </header>

      <InviteClient
        bidShortId={bid.short_id}
        tradeName={trade?.name ?? ""}
        subs={candidates}
        preview={preview}
      />
    </>
  );
}
