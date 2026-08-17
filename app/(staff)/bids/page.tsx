import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BidsClient, { type BidRow } from "./BidsClient";

export const dynamic = "force-dynamic";

export default async function BidsPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id, short_id, status, due_date, cadence, projects(name), trades(name), invitations(id, status, viewed_at, responses(price))"
    )
    .order("created_at", { ascending: false });

  const rows: BidRow[] = (bids ?? []).map((b) => {
    const inv = (b.invitations ?? []) as unknown as {
      status: string;
      viewed_at: string | null;
      responses: { price: number | null }[] | { price: number | null } | null;
    }[];
    const priceOf = (i: (typeof inv)[number]) => {
      const r = Array.isArray(i.responses) ? i.responses[0] : i.responses;
      return r?.price ?? null;
    };
    const prices = inv
      .filter((i) => i.status !== "Denied")
      .map(priceOf)
      .filter((p): p is number => p != null);

    return {
      id: b.id,
      short_id: b.short_id,
      project: (b.projects as unknown as { name: string } | null)?.name ?? "—",
      trade: (b.trades as unknown as { name: string } | null)?.name ?? "—",
      invited: inv.length,
      viewed: inv.filter((i) => i.viewed_at).length,
      received: inv.filter((i) => priceOf(i) != null).length,
      low: prices.length ? Math.min(...prices) : null,
      due_date: b.due_date,
      cadence: b.cadence,
      status: b.status,
    };
  });

  return <BidsClient bids={rows} canWrite={canWrite(user)} />;
}
