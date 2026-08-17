import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revealCode } from "@/lib/accessCode";
import { formatDateShort, money, timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import {
  PreviewAsSubButton,
  AccessCodePanel,
  RequestedChanges,
  type ChangeRequest,
} from "./SubPanels";
import EditSubButton from "./EditSubButton";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";
const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: FAINT,
};

export default async function SubDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: sub } = await supabase
    .from("subs")
    .select(
      "id, short_id, company_name, contact_name, email, phone, city, status, access_code_hash, access_code_enc, code_issued_at, code_last_used_at, created_at, sub_trades(trade_id, trades(name))"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!sub) notFound();

  const [{ data: invitations }, { data: requests }, { data: trades }] = await Promise.all([
    supabase
      .from("invitations")
      .select(
        "id, status, sent_at, viewed_at, bids(short_id, due_date, projects(name), trades(name)), responses(price)"
      )
      .eq("sub_id", sub.id)
      .order("sent_at", { ascending: false }),
    supabase
      .from("change_requests")
      .select("id, field, value, note, status, created_at")
      .eq("sub_id", sub.id)
      .order("created_at", { ascending: false }),
    supabase.from("trades").select("id, name").order("name"),
  ]);

  type Inv = {
    id: string;
    status: string;
    sent_at: string | null;
    viewed_at: string | null;
    bids: {
      short_id: number;
      due_date: string | null;
      projects: { name: string } | null;
      trades: { name: string } | null;
    } | null;
    responses: { price: number | null }[] | { price: number | null } | null;
  };

  const rows = (invitations ?? []) as unknown as Inv[];
  const priceOf = (r: Inv) => {
    const x = Array.isArray(r.responses) ? r.responses[0] : r.responses;
    return x?.price ?? null;
  };

  const invited = rows.length;
  const responded = rows.filter((r) => priceOf(r) != null).length;
  const declined = rows.filter((r) => r.status === "Denied").length;
  const opened = rows.filter((r) => r.viewed_at).length;

  const subTrades = (sub.sub_trades ?? []) as unknown as {
    trade_id: string;
    trades: { name: string } | null;
  }[];
  const tradeNames = subTrades.map((l) => l.trades?.name).filter(Boolean) as string[];

  const facts: [string, string][] = [
    ["Contact", sub.contact_name || "—"],
    ["Email", sub.email || "—"],
    ["Phone", sub.phone || "—"],
    ["City", sub.city || "—"],
    ["Trades", tradeNames.join(", ") || "—"],
    ["Added", timeAgo(sub.created_at)],
  ];

  const stats: [string, string][] = [
    ["Bids invited to", String(invited)],
    ["Prices sent", `${responded} of ${invited}`],
    ["Response rate", invited ? `${Math.round((responded / invited) * 100)}%` : "—"],
    ["Opened but didn't price", String(Math.max(0, opened - responded))],
    ["Declined", String(declined)],
    ["Last portal sign-in", sub.code_last_used_at ? timeAgo(sub.code_last_used_at) : "never"],
  ];

  const changeRequests: ChangeRequest[] = (requests ?? []).map((c) => ({
    id: c.id,
    field: c.field,
    value: c.value,
    note: c.note,
    status: c.status,
    createdAt: c.created_at,
  }));

  return (
    <>
      <header className="pagehead" style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}>
        <Link className="btn btn-ghost" href="/subs" style={{ paddingLeft: 0 }}>← Subs</Link>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
          <div style={{ marginRight: "auto", minWidth: 0 }}>
            <h1 style={{ fontSize: 30, margin: 0 }}>{sub.company_name}</h1>
            <div style={{ fontSize: 13, color: MUTED }}>
              {[sub.contact_name, sub.city, tradeNames.join(", ")].filter(Boolean).join(" · ")}
            </div>
          </div>
          <span className={sub.status === "Active" ? "tag tag-accent" : "tag tag-neutral"} style={{ marginBottom: 6 }}>
            {sub.status}
          </span>
          {canWrite(user) && (
            <EditSubButton
              trades={trades ?? []}
              sub={{
                shortId: sub.short_id,
                companyName: sub.company_name,
                contactName: sub.contact_name,
                email: sub.email,
                phone: sub.phone,
                city: sub.city,
                status: sub.status,
                tradeIds: subTrades.map((l) => l.trade_id),
              }}
            />
          )}
          {canWrite(user) && <PreviewAsSubButton shortId={sub.short_id} />}
        </div>
      </header>

      <div
        className="pagebody cols"
        style={{ padding: "26px 28px 40px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,340px)", gap: 26, alignItems: "start" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 12px" }}>Bid history</h4>
            {rows.length === 0 ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing sent to this sub yet.</p>
            ) : (
              <div className="tablewrap">
                <table className="table" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th>Project / trade</th><th>Sent</th><th>Status</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((h) => (
                      <tr key={h.id} className="clickrow">
                        <td>
                          <Link className="rowlink" href={`/bids/${h.bids?.short_id}`}>
                            {h.bids?.projects?.name ?? "—"}
                          </Link>
                          <div style={{ fontSize: 12, color: MUTED }}>{h.bids?.trades?.name ?? "—"}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{h.sent_at ? formatDateShort(h.sent_at.slice(0, 10)) : "—"}</td>
                        <td><span className="tag tag-accent">{h.status}</span></td>
                        <td className="tabular" style={{ textAlign: "right", fontSize: 13 }}>
                          {priceOf(h) != null ? money(priceOf(h)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Blueprint>

          {changeRequests.length > 0 && (
            <Blueprint style={{ padding: 18 }}>
              <RequestedChanges requests={changeRequests} canWrite={canWrite(user)} />
            </Blueprint>
          )}

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 12px" }}>Contact</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "14px 26px" }}>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <div style={label}>{k}</div>
                  <div style={{ fontSize: 14, wordBreak: "break-word" }}>{v}</div>
                </div>
              ))}
            </div>
          </Blueprint>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Blueprint style={{ padding: 18 }}>
            <AccessCodePanel
              shortId={sub.short_id}
              companyName={sub.company_name}
              code={revealCode(sub.access_code_enc)}
              hasCode={!!sub.access_code_hash}
              canWrite={canWrite(user)}
            />
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 10px" }}>Performance</h4>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: HAIR, fontSize: 13 }}>
                <span style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{k}</span>
                <span className="tabular">{v}</span>
              </div>
            ))}
          </Blueprint>
        </div>
      </div>
    </>
  );
}
