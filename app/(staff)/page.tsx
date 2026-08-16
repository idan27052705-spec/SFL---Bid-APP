import Link from "next/link";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import NudgeList, { type Nudge } from "./NudgeList";
import DashboardActions from "./DashboardActions";

export const dynamic = "force-dynamic";

const DAY = 86400000;
const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: bidRows }, { data: invitations }, { data: activity }, { data: trades }] =
    await Promise.all([
      supabase
        .from("bids")
        .select("id, short_id, title, status, due_date, cadence, projects(short_id, name, city), trades(name)")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("invitations")
        .select("id, status, sent_at, viewed_at, reminders, bid_id, subs(company_name), responses(price)"),
      supabase
        .from("activity")
        .select("id, type, text, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(7),
      supabase.from("trades").select("id, name").order("position"),
    ]);

  const bids = bidRows ?? [];
  const invites = invitations ?? [];
  const now = Date.now();

  const hasPrice = (iv: (typeof invites)[number]) => {
    const r = iv.responses as unknown as unknown[] | unknown | null;
    return Array.isArray(r) ? r.length > 0 : !!r;
  };

  const openBids = bids.filter((b) => b.status === "Out for Bid" || b.status === "Responses In");
  const openIds = new Set(openBids.map((b) => b.id));
  const live = invites.filter((iv) => openIds.has(iv.bid_id));

  const awaiting = live.filter((iv) => !hasPrice(iv) && iv.status !== "Denied");
  const neverOpened = awaiting.filter((iv) => !iv.viewed_at);
  const received = live.filter(hasPrice);

  const daysAway = (due: string | null) =>
    due == null ? null : Math.round((new Date(due + "T00:00:00").getTime() - now) / DAY);
  const sinceSent = (sentAt: string | null) =>
    sentAt ? Math.floor((now - new Date(sentAt).getTime()) / DAY) : 0;

  const dueThisWeek = openBids.filter((b) => {
    const d = daysAway(b.due_date);
    return d != null && d <= 7;
  });

  const projectCount = new Set(
    openBids.map((b) => (b.projects as unknown as { name: string } | null)?.name)
  ).size;

  const stats = [
    {
      label: "Bids out for pricing",
      value: openBids.length,
      delta: projectCount ? `${projectCount} project${projectCount === 1 ? "" : "s"}` : "",
      note: "Packages subs can still price",
    },
    {
      label: "Awaiting response",
      value: awaiting.length,
      delta: neverOpened.length ? `${neverOpened.length} never opened` : "",
      note: "Invitations with no price yet",
    },
    {
      label: "Due this week",
      value: dueThisWeek.length,
      delta: dueThisWeek.some((b) => (daysAway(b.due_date) ?? 99) <= 1) ? "closing now" : "",
      note: "Bids closing within seven days",
    },
    {
      label: "Prices received",
      value: received.length,
      delta: "",
      note: "Ready to compare",
    },
  ];

  const dashBids = openBids.slice(0, 6).map((b) => {
    const inv = invites.filter((i) => i.bid_id === b.id);
    const got = inv.filter(hasPrice).length;
    const viewedNoPrice = inv.filter((i) => i.viewed_at && !hasPrice(i)).length;
    const quiet = inv.length - inv.filter((i) => i.viewed_at).length;
    const denied = inv.filter((i) => i.status === "Denied").length;
    const pct = (n: number) => (inv.length ? `${Math.round((n / inv.length) * 100)}%` : "0%");
    const d = daysAway(b.due_date);

    return {
      id: b.id,
      shortId: b.short_id,
      project: (b.projects as unknown as { name: string } | null)?.name ?? "—",
      city: (b.projects as unknown as { city: string | null } | null)?.city ?? "",
      trade: (b.trades as unknown as { name: string } | null)?.name ?? "—",
      wReceived: pct(got),
      wViewed: pct(viewedNoPrice),
      responseLabel: `${got} of ${inv.length}`,
      trackingNote:
        (quiet > 0 ? `${quiet} never opened` : "All opened") + (denied ? ` · ${denied} declined` : ""),
      due: formatDateShort(b.due_date),
      dueNote:
        d == null ? "" : d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`,
      cadence: b.cadence,
      status: b.status,
    };
  });

  const nudges: Nudge[] = awaiting
    .filter((iv) => iv.sent_at)
    .map((iv) => {
      const bid = bids.find((b) => b.id === iv.bid_id);
      return {
        invitationId: iv.id,
        company: (iv.subs as unknown as { company_name: string } | null)?.company_name ?? "—",
        context: `${(bid?.projects as unknown as { name: string } | null)?.name ?? ""} · ${
          (bid?.trades as unknown as { name: string } | null)?.name ?? ""
        }`,
        state: iv.viewed_at
          ? `Opened ${timeAgo(iv.viewed_at)} — no price`
          : `Sent ${timeAgo(iv.sent_at)} — never opened`,
        daysSinceSent: sinceSent(iv.sent_at),
      };
    })
    .sort((a, b) => b.daysSinceSent - a.daysSinceSent);

  const dueSoon = dueThisWeek.slice(0, 5).map((b) => {
    const inv = invites.filter((i) => i.bid_id === b.id);
    const dt = b.due_date ? new Date(b.due_date + "T00:00:00") : null;
    return {
      id: b.id,
      shortId: b.short_id,
      day: dt ? dt.toLocaleDateString("en-US", { weekday: "short" }) : "—",
      trade: (b.trades as unknown as { name: string } | null)?.name ?? "—",
      project: (b.projects as unknown as { name: string } | null)?.name ?? "",
      counts: `${inv.filter(hasPrice).length} of ${inv.length}`,
    };
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      <header
        className="pagehead"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Dashboard</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            {today} · {openBids.length} bid{openBids.length === 1 ? "" : "s"} out for pricing
          </div>
        </div>
        {canWrite(user) && <DashboardActions trades={trades ?? []} />}
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px", display: "flex", flexDirection: "column", gap: 26 }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 18 }}>
          {stats.map((s) => (
            <Blueprint key={s.label} style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>
                {s.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 40, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{s.delta}</div>
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>{s.note}</div>
            </Blueprint>
          ))}
        </section>

        <section className="cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,2.1fr) minmax(300px,1fr)", gap: 26, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
            <Blueprint style={{ padding: "16px 18px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <h4 style={{ margin: 0 }}>Bids out for pricing</h4>
                <Link className="btn btn-ghost" href="/bids" style={{ marginLeft: "auto" }}>View all</Link>
              </div>
              {dashBids.length === 0 ? (
                <p style={{ fontSize: 14, color: MUTED, paddingBottom: 12 }}>
                  Nothing out for pricing. {canWrite(user) && <Link href="/projects">Start a project</Link>}
                </p>
              ) : (
                <div className="tablewrap">
                  <table className="table" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th style={{ width: "34%" }}>Project / trade</th>
                        <th style={{ width: "24%" }}>Responses</th>
                        <th>Due</th><th>Reminders</th>
                        <th style={{ textAlign: "right" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashBids.map((b) => (
                        <tr key={b.id} className="clickrow">
                          <td>
                            <Link className="rowlink" href={`/bids/${b.shortId}`} style={{ fontWeight: 500 }}>{b.project}</Link>
                            <div style={{ fontSize: 12, color: MUTED }}>{b.trade}{b.city ? ` · ${b.city}` : ""}</div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 70, height: 6, background: "var(--color-neutral-200)", display: "flex" }}>
                                <div style={{ height: "100%", background: "var(--color-accent-700)", width: b.wReceived }} />
                                <div style={{ height: "100%", background: "var(--color-accent-400)", width: b.wViewed }} />
                              </div>
                              <div className="tabular" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{b.responseLabel}</div>
                            </div>
                            <div style={{ fontSize: 11, color: FAINT }}>{b.trackingNote}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>
                            <div>{b.due}</div>
                            <div style={{ fontSize: 11, color: FAINT }}>{b.dueNote}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{b.cadence}</td>
                          <td style={{ textAlign: "right" }}><span className="tag tag-accent">{b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Blueprint>

            <Blueprint style={{ padding: "16px 18px 18px" }}>
              <NudgeList nudges={nudges} />
            </Blueprint>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
            <Blueprint style={{ padding: "16px 18px 18px" }}>
              <h4 style={{ margin: "0 0 10px" }}>Due this week</h4>
              {dueSoon.length === 0 ? (
                <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing closing this week.</p>
              ) : (
                dueSoon.map((d) => (
                  <Link key={d.id} href={`/bids/${d.shortId}`} className="clickrow"
                    style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "9px 0", borderTop: HAIR, textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase", width: 56, flex: "none", color: "var(--color-accent-700)" }}>
                      {d.day}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.trade}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{d.project}</div>
                    </div>
                    <div className="tabular" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{d.counts}</div>
                  </Link>
                ))
              )}
            </Blueprint>

            <Blueprint style={{ padding: "16px 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <h4 style={{ margin: 0 }}>Recent activity</h4>
                <Link className="btn btn-ghost" href="/activity" style={{ marginLeft: "auto" }}>Full log</Link>
              </div>
              {(activity ?? []).length === 0 ? (
                <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing yet.</p>
              ) : (
                (activity ?? []).map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: HAIR }}>
                    <div style={{ width: 7, height: 7, marginTop: 6, flex: "none", background: "var(--color-accent-500)" }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{a.text}</div>
                      <div style={{ fontSize: 11, color: FAINT }}>
                        {timeAgo(a.created_at)}{a.meta ? ` · ${a.meta}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Blueprint>
          </div>
        </section>
      </div>
    </>
  );
}
