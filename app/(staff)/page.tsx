import Link from "next/link";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, timeAgo } from "@/lib/format";
import NudgeList, { type Nudge } from "./NudgeList";

export const dynamic = "force-dynamic";

const DAY = 86400000;

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: bids }, { data: invitations }, { data: activity }] =
    await Promise.all([
      supabase
        .from("bids")
        .select(
          "id, short_id, title, status, due_date, projects(short_id, name), trades(name)"
        )
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("invitations")
        .select(
          "id, status, sent_at, viewed_at, reminders, bid_id, subs(company_name), responses(price)"
        ),
      supabase
        .from("activity")
        .select("id, type, text, meta, created_at, bid_id")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const allBids = bids ?? [];
  const allInvites = invitations ?? [];

  const hasPrice = (iv: (typeof allInvites)[number]) => {
    const r = iv.responses as unknown as unknown[] | unknown | null;
    return Array.isArray(r) ? r.length > 0 : !!r;
  };

  const openBids = allBids.filter(
    (b) => b.status === "Out for Bid" || b.status === "Responses In"
  );
  const openBidIds = new Set(openBids.map((b) => b.id));

  const liveInvites = allInvites.filter((iv) => openBidIds.has(iv.bid_id));
  const awaiting = liveInvites.filter(
    (iv) => !hasPrice(iv) && iv.status !== "Denied"
  );
  const neverOpened = awaiting.filter((iv) => !iv.viewed_at);
  const received = liveInvites.filter(hasPrice);

  const now = Date.now();
  const dueThisWeek = openBids.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date + "T00:00:00").getTime();
    return d - now <= 7 * DAY;
  });

  const stats = [
    {
      label: "Out for pricing",
      value: openBids.length,
      note: `across ${new Set(openBids.map((b) => (b.projects as unknown as { name: string } | null)?.name)).size} project(s)`,
    },
    {
      label: "Waiting on subs",
      value: awaiting.length,
      note: `${neverOpened.length} never opened it`,
    },
    {
      label: "Due this week",
      value: dueThisWeek.length,
      note: dueThisWeek.length ? "closing soon" : "nothing closing",
    },
    {
      label: "Prices in",
      value: received.length,
      note: received.length ? "ready to compare" : "none yet",
    },
  ];

  // Gone quiet: sent 2+ days ago, still no price, not declined.
  const nudges: Nudge[] = awaiting
    .filter((iv) => {
      if (!iv.sent_at) return false;
      return now - new Date(iv.sent_at).getTime() >= 2 * DAY;
    })
    .map((iv) => {
      const bid = allBids.find((b) => b.id === iv.bid_id);
      const sub = iv.subs as unknown as { company_name: string } | null;
      return {
        invitationId: iv.id,
        company: sub?.company_name ?? "—",
        trade: (bid?.trades as unknown as { name: string } | null)?.name ?? "",
        project:
          (bid?.projects as unknown as { name: string } | null)?.name ?? "",
        bidShortId: bid?.short_id ?? 0,
        sentAt: iv.sent_at,
        viewedAt: iv.viewed_at,
        reminders: iv.reminders ?? 0,
      };
    })
    .sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));

  const closing = openBids.slice(0, 6);

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">{user.companyName}</h6>
        <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
        <p className="text-muted">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="pagebody" style={{ display: "grid", gap: 22 }}>
        <div
          className="cols"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {stats.map((s) => (
            <div key={s.label} className="card">
              <div className="card-kicker">{s.label}</div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 36,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {s.note}
              </div>
            </div>
          ))}
        </div>

        {allBids.length === 0 ? (
          <div className="card" style={{ padding: 28, alignItems: "flex-start" }}>
            <div className="card-title">Nothing out for bid yet</div>
            <p className="card-body">
              Create a project, build a bid package for a trade, and invite your
              subs. Their prices land back here.
            </p>
            {canWrite(user) && (
              <Link className="btn btn-primary" href="/projects">
                Start a project
              </Link>
            )}
          </div>
        ) : (
          <div
            className="cols"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)",
              gap: 22,
            }}
          >
            <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
              <section>
                <h5>Gone quiet</h5>
                <p className="text-muted" style={{ fontSize: 13, marginTop: -6 }}>
                  Sent two or more days ago with no price yet.
                </p>
                <NudgeList nudges={nudges} />
              </section>

              <section>
                <h5>Out for pricing</h5>
                {closing.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 14 }}>
                    Nothing out at the moment.
                  </p>
                ) : (
                  <div className="tablewrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Trade</th>
                          <th>Project</th>
                          <th>Due</th>
                          <th>In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closing.map((b) => {
                          const inv = allInvites.filter((i) => i.bid_id === b.id);
                          const got = inv.filter(hasPrice).length;
                          return (
                            <tr key={b.id}>
                              <td>
                                <Link className="rowlink" href={`/bids/${b.short_id}`}>
                                  <strong>
                                    {(b.trades as unknown as { name: string } | null)?.name}
                                  </strong>
                                </Link>
                              </td>
                              <td>
                                {(b.projects as unknown as { name: string } | null)?.name}
                              </td>
                              <td>{formatDate(b.due_date)}</td>
                              <td>
                                {got} of {inv.length}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-kicker">Recent activity</div>
              {(activity ?? []).length === 0 ? (
                <p className="card-body">Nothing yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
                  {(activity ?? []).map((a) => (
                    <li
                      key={a.id}
                      style={{
                        padding: "7px 0",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                      }}
                    >
                      <div>{a.text}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {timeAgo(a.created_at)}
                        {a.meta ? ` · ${a.meta}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
