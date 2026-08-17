import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { formatDate } from "@/lib/format";
import { getCompany, companyFooter } from "@/lib/company";
import PortalShell from "../../PortalShell";
import BidActions from "./BidActions";

export const dynamic = "force-dynamic";

export default async function PortalBidPage({
  params,
}: {
  params: { id: string };
}) {
  const sub = await getPortalSub();
  if (!sub) redirect("/portal");

  const lang = pickLang(cookies().get("sfl_lang")?.value);
  const t = STR[lang];
  const admin = createAdminClient();

  const { data: bid } = await admin
    .from("bids")
    .select(
      "id, short_id, title, scope, due_date, status, awarded_sub_id, projects(name, city, address), trades(name)"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();

  // The invitation IS the permission. No invitation, no page — even if
  // they guess the number in the URL.
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, status, viewed_at, decline_reason, responses(price, lead_time, exclusions, notes)")
    .eq("bid_id", bid.id)
    .eq("sub_id", sub.id)
    .maybeSingle();

  if (!invitation) notFound();

  /**
   * "Opened the bid" now means they actually looked at it. It used to be
   * stamped when the emailed link was clicked, which could happen from a
   * preview pane without anyone reading anything.
   */
  if (!invitation.viewed_at && !sub.isPreview) {
    await admin
      .from("invitations")
      .update({
        viewed_at: new Date().toISOString(),
        status:
          invitation.status === "Sent" || invitation.status === "No Response"
            ? "Viewed"
            : invitation.status,
      })
      .eq("id", invitation.id);

    await admin.from("activity").insert({
      company_id: sub.company_id,
      type: "viewed",
      text: `${sub.company_name} opened the bid`,
      meta: (bid.trades as unknown as { name: string } | null)?.name ?? null,
      bid_id: bid.id,
    });
  }

  const { data: lineItems } = await admin
    .from("bid_line_items")
    .select("id, description, detail, qty, unit")
    .eq("bid_id", bid.id)
    .order("position");

  const { data: attached } = await admin
    .from("bid_files")
    .select("files(id, name, kind, size_bytes)")
    .eq("bid_id", bid.id)
    .order("position");

  type PortalFile = { id: string; name: string; kind: string; size_bytes: number | null };

  const files = ((attached ?? []) as unknown as { files: PortalFile | null }[])
    .map((a) => a.files)
    .filter(Boolean) as PortalFile[];

  // Drawings read as a list; photos and video belong in a gallery.
  const docs = files.filter((f) => f.kind === "doc");
  const media = files.filter((f) => f.kind === "photo" || f.kind === "video");

  const project = bid.projects as unknown as {
    name: string;
    city: string | null;
    address: string | null;
  } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  const r = invitation.responses as unknown as
    | { price: number | null; lead_time: string | null; exclusions: string | null; notes: string | null }[]
    | { price: number | null; lead_time: string | null; exclusions: string | null; notes: string | null }
    | null;
  const existing = Array.isArray(r) ? (r[0] ?? null) : r;

  const closed = bid.status === "Awarded" || bid.status === "Closed";
  const won = bid.awarded_sub_id === sub.id;

  const company = await getCompany(sub.company_id);
  const shell = { name: company.name, footer: companyFooter(company), phone: company.phone };

  return (
    <PortalShell company={shell} preview={sub.isPreview} lang={lang} subName={sub.company_name}>
      <Link href="/portal/bids" className="btn btn-ghost" style={{ padding: 0, marginBottom: 12 }}>
        ← {t.back}
      </Link>

      <div className="card-kicker">{trade?.name}</div>
      <h2 style={{ marginTop: 4, marginBottom: 4 }}>{project?.name}</h2>
      <div style={{ fontSize: 15, marginBottom: 8 }}>{bid.title}</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {bid.due_date && (
          <span className="tag tag-outline">
            {t.due} {formatDate(bid.due_date)}
          </span>
        )}
        {project?.city && <span className="tag tag-neutral">{project.city}</span>}
        {won && <span className="tag tag-accent">{t.awarded}</span>}
        {closed && !won && <span className="tag tag-neutral">{t.notAwarded}</span>}
      </div>

      {bid.scope && (
        <section style={{ marginBottom: 18 }}>
          <h5>{t.scope}</h5>
          <p style={{ fontSize: 15, whiteSpace: "pre-wrap" }}>{bid.scope}</p>
        </section>
      )}

      {(lineItems ?? []).length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <table className="table">
            <tbody>
              {(lineItems ?? []).map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.description}
                    {i.detail && (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {i.detail}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {i.qty ?? ""} {i.unit ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <BidActions
        shortId={bid.short_id}
        lang={lang}
        existing={existing}
        declinedReason={invitation.status === "Denied" ? invitation.decline_reason : null}
        closed={closed}
        docs={docs}
        media={media}
      />
    </PortalShell>
  );
}
