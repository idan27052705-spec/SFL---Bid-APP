import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import CompareClient, { type Quote } from "./CompareClient";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function ComparePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select("id, short_id, awarded_sub_id, projects(name), trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();

  const { data: invitations } = await supabase
    .from("invitations")
    .select(
      "id, status, sub_id, subs(company_name), responses(price, lead_time, exclusions, notes, submitted_at, file_id)"
    )
    .eq("bid_id", bid.id);

  type Row = {
    id: string;
    status: string;
    sub_id: string;
    subs: { company_name: string } | null;
    responses:
      | {
          price: number | null;
          lead_time: string | null;
          exclusions: string | null;
          notes: string | null;
          submitted_at: string | null;
          file_id: string | null;
        }[]
      | null;
  };

  const rows = (invitations ?? []) as unknown as Row[];
  const responseOf = (r: Row) => (Array.isArray(r.responses) ? r.responses[0] : r.responses);

  const priced = rows
    .filter((r) => responseOf(r)?.price != null && r.status !== "Denied")
    .sort((a, b) => (responseOf(a)!.price ?? 0) - (responseOf(b)!.price ?? 0));

  const low = priced.length ? responseOf(priced[0])!.price! : 0;

  const quotes: Quote[] = priced.map((r, i) => {
    const resp = responseOf(r)!;
    const over = (resp.price ?? 0) - low;
    return {
      invitationId: r.id,
      subId: r.sub_id,
      company: r.subs?.company_name ?? "—",
      price: resp.price ?? 0,
      rank: i === 0 ? "Low bid" : `+${money(over)}`,
      leadTime: resp.lead_time,
      exclusions: resp.exclusions,
      notes: resp.notes,
      submittedAt: resp.submitted_at,
      fileId: resp.file_id,
      awarded: bid.awarded_sub_id === r.sub_id,
    };
  });

  const project = bid.projects as unknown as { name: string } | null;
  const trade = bid.trades as unknown as { name: string } | null;
  const totalInvited = rows.length;

  return (
    <>
      <header
        className="pagehead"
        style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link className="btn btn-ghost" href={`/bids/${bid.short_id}`} style={{ paddingLeft: 0 }}>
          ← {trade?.name}
        </Link>
        <h1 style={{ fontSize: 30, margin: "4px 0 0" }}>Compare responses</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          {project?.name} · {trade?.name} · {quotes.length} of {totalInvited} priced
        </div>
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        <CompareClient
          bidShortId={bid.short_id}
          quotes={quotes}
          canWrite={canWrite(user)}
          awarded={!!bid.awarded_sub_id}
        />
      </div>
    </>
  );
}
