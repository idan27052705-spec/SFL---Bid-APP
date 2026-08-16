import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { formatDate, money } from "@/lib/format";
import PortalShell from "../PortalShell";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";

function daysLeft(due: string | null) {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default async function PortalBidsPage() {
  const sub = await getPortalSub();
  if (!sub) redirect("/portal");

  const lang = pickLang(cookies().get("sfl_lang")?.value);
  const t = STR[lang];
  const admin = createAdminClient();

  // Service role bypasses RLS — this MUST stay scoped to the signed-in sub.
  const { data: invitations } = await admin
    .from("invitations")
    .select(
      "id, status, sent_at, bids(short_id, title, due_date, status, awarded_sub_id, projects(name, city), trades(name)), responses(price)"
    )
    .eq("sub_id", sub.id)
    .order("sent_at", { ascending: false });

  type Row = {
    id: string;
    status: string;
    bid: {
      short_id: number;
      title: string;
      due_date: string | null;
      status: string;
      awarded_sub_id: string | null;
      projects: { name: string; city: string | null } | null;
      trades: { name: string } | null;
    } | null;
    price: number | null;
  };

  const rows: Row[] = (invitations ?? []).map((iv) => {
    const r = iv.responses as unknown as { price: number | null }[] | { price: number | null } | null;
    return {
      id: iv.id,
      status: iv.status,
      bid: iv.bids as never,
      price: Array.isArray(r) ? (r[0]?.price ?? null) : (r?.price ?? null),
    };
  });

  const isClosed = (r: Row) =>
    r.bid?.status === "Awarded" || r.bid?.status === "Closed" || r.status === "Denied";

  const waiting = rows.filter((r) => !isClosed(r) && r.status !== "Received");
  const submitted = rows.filter((r) => !isClosed(r) && r.status === "Received");
  const past = rows.filter(isClosed);

  const dueLabel = (due: string | null) => {
    const d = daysLeft(due);
    if (d == null) return t.due;
    if (d < 0) return `${Math.abs(d)} ${t.overdue}`;
    if (d === 0) return t.today;
    if (d === 1) return t.tomorrow;
    return `${d} ${t.inDays}`;
  };

  const headline =
    waiting.length === 0
      ? t.nothingWaiting
      : `${waiting.length} ${waiting.length === 1 ? "bid" : "bids"} ${t.waiting.toLowerCase()}`;

  return (
    <PortalShell lang={lang} subName={sub.company_name}>
      <div
        style={{
          width: "min(100%, 1080px)",
          margin: "0 auto",
          padding: "32px 24px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 34,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <div style={{ marginRight: "auto", minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
              {sub.company_name}
            </div>
            <h1 style={{ fontSize: 40, margin: "2px 0 0" }}>{headline}</h1>
          </div>
          <div style={{ display: "flex", gap: 26 }}>
            {[
              [submitted.length, t.submitted],
              [past.length, t.past],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 28, lineHeight: 1 }}>
                  {n}
                </div>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: FAINT }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <h4 style={{ margin: 0, letterSpacing: ".02em" }}>{t.waiting}</h4>
            <span style={{ fontSize: 12, color: FAINT }}>{waiting.length}</span>
          </div>

          {waiting.length === 0 ? (
            <div className="blueprint" style={{ padding: 28, textAlign: "center", fontSize: 14, color: MUTED }}>
              {t.nothingWaiting}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 16 }}>
              {waiting.map((r) => (
                <Link
                  key={r.id}
                  href={`/portal/bids/${r.bid?.short_id}`}
                  className="blueprint"
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 24, lineHeight: 1.05 }}>
                    {r.bid?.trades?.name}
                  </div>
                  <div style={{ fontSize: 15 }}>{r.bid?.projects?.name}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{r.bid?.projects?.city}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                    <span className="tag tag-accent">{dueLabel(r.bid?.due_date ?? null)}</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--color-accent-700)",
                      }}
                    >
                      {t.submitQuote} →
                    </span>
                  </div>
                  <i className="corner tl" /><i className="corner tr" />
                  <i className="corner bl" /><i className="corner br" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {submitted.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 10px" }}>{t.submitted}</h4>
            <div className="blueprint" style={{ padding: "6px 18px" }}>
              <table className="table">
                <tbody>
                  {submitted.map((r) => (
                    <tr key={r.id} className="clickrow">
                      <td>
                        <Link
                          href={`/portal/bids/${r.bid?.short_id}`}
                          style={{ fontWeight: 500, textDecoration: "none", color: "inherit" }}
                        >
                          {r.bid?.trades?.name}
                        </Link>
                        <div style={{ fontSize: 12, color: MUTED }}>{r.bid?.projects?.name}</div>
                      </td>
                      <td className="tabular" style={{ textAlign: "right", fontSize: 15 }}>
                        {r.price != null ? money(r.price) : "—"}
                      </td>
                      <td style={{ textAlign: "right", width: 120 }}>
                        <span className="tag tag-accent">{t.statusReceived}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 10px" }}>{t.past}</h4>
            <div className="blueprint" style={{ padding: "6px 18px" }}>
              <table className="table">
                <tbody>
                  {past.map((r) => {
                    const won = r.bid?.awarded_sub_id === sub.id;
                    return (
                      <tr key={r.id} className="clickrow">
                        <td>
                          <Link
                            href={`/portal/bids/${r.bid?.short_id}`}
                            style={{ fontWeight: 500, textDecoration: "none", color: "inherit" }}
                          >
                            {r.bid?.trades?.name}
                          </Link>
                          <div style={{ fontSize: 12, color: MUTED }}>
                            {r.bid?.projects?.name} · {formatDate(r.bid?.due_date ?? null)}
                          </div>
                        </td>
                        <td className="tabular" style={{ textAlign: "right", fontSize: 15 }}>
                          {r.price != null ? money(r.price) : "—"}
                        </td>
                        <td style={{ textAlign: "right", width: 140 }}>
                          <span className={won ? "tag tag-accent" : "tag tag-neutral"}>
                            {won ? t.awarded : r.status === "Denied" ? t.statusDenied : t.notAwarded}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
