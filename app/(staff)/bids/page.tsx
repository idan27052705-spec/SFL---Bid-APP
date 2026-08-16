import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BidsClient, { type BidRow } from "./BidsClient";

export const dynamic = "force-dynamic";

export default async function BidsPage() {
  await requireUser();
  const supabase = createClient();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id, short_id, title, status, due_date, projects(short_id, name), trades(name), invitations(id, responses(id))"
    )
    .order("created_at", { ascending: false });

  const rows: BidRow[] = (bids ?? []).map((b) => {
    const project = b.projects as unknown as { short_id: number; name: string } | null;
    const trade = b.trades as unknown as { name: string } | null;
    const invites = (b.invitations ?? []) as unknown as { responses: unknown[] }[];

    return {
      id: b.id,
      short_id: b.short_id,
      title: b.title,
      status: b.status,
      due_date: b.due_date,
      trade: trade?.name ?? "—",
      project: project?.name ?? "—",
      projectShortId: project?.short_id ?? 0,
      invited: invites.length,
      received: invites.filter((i) => {
        const r = i.responses;
        return Array.isArray(r) ? r.length > 0 : !!r;
      }).length,
    };
  });

  return <BidsClient bids={rows} />;
}
