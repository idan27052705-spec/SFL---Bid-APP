import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Blueprint from "@/components/Blueprint";
import { TradesEditor } from "../SettingsClients";

export const dynamic = "force-dynamic";
const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function TradesPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: trades }, { data: bids }, { data: subTrades }] = await Promise.all([
    supabase.from("trades").select("id, name").order("position"),
    supabase.from("bids").select("trade_id"),
    supabase.from("sub_trades").select("trade_id"),
  ]);

  const bidCount = new Map<string, number>();
  (bids ?? []).forEach((b) => b.trade_id && bidCount.set(b.trade_id, (bidCount.get(b.trade_id) ?? 0) + 1));
  const subCount = new Map<string, number>();
  (subTrades ?? []).forEach((s) => subCount.set(s.trade_id, (subCount.get(s.trade_id) ?? 0) + 1));

  const rows = (trades ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    bids: bidCount.get(t.id) ?? 0,
    subs: subCount.get(t.id) ?? 0,
  }));

  return (
    <>
      <header className="pagehead" style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Trades</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          Trades are data, not code — add or retire them here
        </div>
      </header>
      <div className="pagebody" style={{ padding: "26px 28px 40px", maxWidth: 620 }}>
        <Blueprint style={{ padding: 18 }}>
          <TradesEditor trades={rows} canWrite={canWrite(user)} />
        </Blueprint>
      </div>
    </>
  );
}
