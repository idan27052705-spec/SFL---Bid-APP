import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateShort, money, timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import Tabs from "@/components/Tabs";
import ProjectActions from "./ProjectActions";
import ProjectFiles, { type FileRow } from "./ProjectFiles";
import CostBreakdown from "./CostBreakdown";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["bids", "Bids"],
  ["costs", "Cost summary"],
  ["files", "Files"],
  ["activity", "Activity"],
] as const;

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: FAINT,
};


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await requireUser();
  const supabase = createClient();
  const tab = searchParams.tab ?? "overview";

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("short_id", Number(params.id))
    .single();

  if (!project) notFound();

  const [{ data: bidRows }, { data: files }, { data: activity }] =
    await Promise.all([
      supabase
        .from("bids")
        .select(
          "id, short_id, title, status, due_date, cadence, awarded_sub_id, trades(name), invitations(id, status, viewed_at, sub_id, subs(company_name), responses(price))"
        )
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("files")
        .select("id, name, size_bytes, kind, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity")
        .select("id, type, text, meta, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  type Inv = {
    id: string;
    status: string;
    viewed_at: string | null;
    sub_id: string;
    subs: { company_name: string } | null;
    responses: { price: number | null }[] | { price: number | null } | null;
  };

  const bids = (bidRows ?? []).map((b) => {
    const invites = (b.invitations ?? []) as unknown as Inv[];
    const priceOf = (i: Inv) => {
      const r = i.responses;
      const one = Array.isArray(r) ? r[0] : r;
      return one?.price ?? null;
    };
    const prices = invites
      .filter((i) => i.status !== "Denied")
      .map(priceOf)
      .filter((p): p is number => p != null);

    return {
      id: b.id,
      shortId: b.short_id,
      title: b.title,
      status: b.status,
      due: b.due_date,
      cadence: b.cadence,
      trade: (b.trades as unknown as { name: string } | null)?.name ?? "—",
      awardedSubId: b.awarded_sub_id,
      invited: invites.length,
      viewed: invites.filter((i) => i.viewed_at).length,
      received: invites.filter((i) => priceOf(i) != null).length,
      denied: invites.filter((i) => i.status === "Denied").length,
      prices,
      low: prices.length ? Math.min(...prices) : null,
      high: prices.length ? Math.max(...prices) : null,
      avg: prices.length
        ? Math.round(prices.reduce((a, b2) => a + b2, 0) / prices.length)
        : null,
      awardedPrice: (() => {
        if (!b.awarded_sub_id) return null;
        const won = invites.find((i) => i.sub_id === b.awarded_sub_id);
        return won ? priceOf(won) : null;
      })(),
      awardedCompany: (() => {
        if (!b.awarded_sub_id) return null;
        const won = invites.find((i) => i.sub_id === b.awarded_sub_id);
        return won?.subs?.company_name ?? null;
      })(),
      lowCompany: (() => {
        if (!prices.length) return null;
        const min = Math.min(...prices);
        const who = invites.find((i) => priceOf(i) === min);
        return who?.subs?.company_name ?? null;
      })(),

      // Every sub on this package, so the cost breakdown can show who
      // is behind each number instead of one blended figure per trade.
      quotes: invites
        .map((i) => ({
          id: i.id,
          company: i.subs?.company_name ?? "—",
          price: priceOf(i),
          declined: i.status === "Denied",
          awarded: b.awarded_sub_id != null && i.sub_id === b.awarded_sub_id,
        }))
        .sort((x, y) => {
          // Priced first, cheapest at the top; everyone else underneath.
          if (x.price == null && y.price == null) return 0;
          if (x.price == null) return 1;
          if (y.price == null) return -1;
          return x.price - y.price;
        }),
    };
  });

  // Cost summary: one number per trade, added up.
  const withPrices = bids.filter((b) => b.prices.length > 0);
  const sum = (pick: (b: (typeof bids)[number]) => number | null) =>
    withPrices.reduce((total, b) => total + (pick(b) ?? 0), 0);

  const costTotals = {
    low: sum((b) => b.low),
    avg: sum((b) => b.avg),
    high: sum((b) => b.high),
    // What the job actually costs today: the awarded price where you've
    // awarded, the low price everywhere else.
    carried: sum((b) => b.awardedPrice ?? b.low),
  };
  const spread = costTotals.high - costTotals.low;

  const facts: [string, string][] = [
    ["Client", project.client || "—"],
    ["Type", project.type || "—"],
    ["City", project.city || "—"],
    ["County", project.county || "—"],
    ["Address", project.address || "—"],
    ["Start", project.start_date ? formatDate(project.start_date) : "—"],
    ["Stage", project.status],
    ["Bids", `${bids.length} trade${bids.length === 1 ? "" : "s"}`],
  ];

  return (
    <>
      <header
        className="pagehead"
        style={{ padding: "18px 28px 0", borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link className="btn btn-ghost" href="/projects" style={{ paddingLeft: 0 }}>
          ← Projects
        </Link>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
          <div style={{ marginRight: "auto", minWidth: 0 }}>
            <h1 style={{ fontSize: 30, margin: 0 }}>{project.name}</h1>
            <div style={{ fontSize: 13, color: MUTED }}>
              {[project.address, project.county ? `${project.county} County` : null, project.client]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          {canWrite(user) ? (
            <ProjectActions
              shortId={project.short_id}
              name={project.name}
              status={project.status}
              fields={{
                name: project.name ?? "",
                client: project.client ?? "",
                address: project.address ?? "",
                city: project.city ?? "",
                county: project.county ?? "Broward",
                type: project.type ?? "",
                startDate: project.start_date ?? "",
                description: project.description ?? "",
              }}
            />
          ) : (
            <span className="tag tag-accent" style={{ marginBottom: 6 }}>
              {project.status}
            </span>
          )}
          {canWrite(user) && project.status !== "Archived" && (
            <Link
              className="btn btn-primary blueprint"
              href={`/projects/${project.short_id}/bids/new`}
            >
              <Plus size={15} />
              New bid
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
            </Link>
          )}
        </div>

        <Suspense>
          <Tabs tabs={TABS} current={tab} />
        </Suspense>
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div
            className="cols"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)",
              gap: 26,
              alignItems: "start",
            }}
          >
            <Blueprint style={{ padding: 18 }}>
              <h4 style={{ margin: "0 0 14px" }}>Project details</h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                  gap: "14px 26px",
                }}
              >
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <div style={label}>{k}</div>
                    <div style={{ fontSize: 14 }}>{v}</div>
                  </div>
                ))}
              </div>
              {project.description && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: "1px solid var(--color-divider)",
                  }}
                >
                  <div style={{ ...label, marginBottom: 4 }}>Scope description</div>
                  <div style={{ fontSize: 14, maxWidth: "64ch", textWrap: "pretty" }}>
                    {project.description}
                  </div>
                </div>
              )}
            </Blueprint>

            <Blueprint style={{ padding: 18 }}>
              <h4 style={{ margin: "0 0 12px" }}>Bid coverage</h4>
              {bids.length === 0 ? (
                <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                  No bid packages yet.
                </p>
              ) : (
                bids.map((b) => (
                  <Link
                    key={b.id}
                    href={`/bids/${b.shortId}`}
                    className="clickrow"
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "9px 0",
                      borderTop: HAIR,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{b.trade}</div>
                      <div style={{ fontSize: 11, color: FAINT }}>
                        {b.received} of {b.invited} priced · due {formatDateShort(b.due)}
                      </div>
                    </div>
                    <span className="tag tag-outline">{b.status}</span>
                  </Link>
                ))
              )}
            </Blueprint>
          </div>
        )}

        {/* ── BIDS ── */}
        {tab === "bids" && (
          <Blueprint style={{ padding: "12px 18px 6px" }}>
            <div className="tablewrap">
              <table className="table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th>Invited</th>
                    <th>Viewed</th>
                    <th>Received</th>
                    <th>Denied</th>
                    <th>Due</th>
                    <th>Cadence</th>
                    <th style={{ textAlign: "right" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ color: MUTED }}>
                        No bid packages yet.
                      </td>
                    </tr>
                  ) : (
                    bids.map((b) => (
                      <tr key={b.id} className="clickrow">
                        <td>
                          <Link className="rowlink" href={`/bids/${b.shortId}`} style={{ fontWeight: 500 }}>
                            {b.trade}
                          </Link>
                          <div style={{ fontSize: 12, color: MUTED }}>{b.title}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{b.invited}</td>
                        <td style={{ fontSize: 13 }}>{b.viewed}</td>
                        <td style={{ fontSize: 13 }}>{b.received}</td>
                        <td style={{ fontSize: 13 }}>{b.denied}</td>
                        <td style={{ fontSize: 13 }}>{formatDateShort(b.due)}</td>
                        <td style={{ fontSize: 13 }}>{b.cadence}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="tag tag-accent">{b.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Blueprint>
        )}

        {/* ── COST SUMMARY ── */}
        {tab === "costs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                gap: 18,
              }}
            >
              {[
                ["Low total", costTotals.low, "Cheapest price in every trade", false],
                ["Average total", costTotals.avg, "Mean of all prices received", false],
                ["High total", costTotals.high, `Spread ${money(spread)}`, false],
                [
                  "Carried number",
                  costTotals.carried,
                  "Awarded where awarded, low elsewhere",
                  true,
                ],
              ].map(([title, value, note, accent]) => (
                <Blueprint key={title as string} style={{ padding: "14px 16px" }}>
                  <div
                    style={{
                      ...label,
                      letterSpacing: ".12em",
                      color: accent ? "var(--color-accent-700)" : MUTED,
                    }}
                  >
                    {title as string}
                  </div>
                  <div
                    className="tabular"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: 32,
                      lineHeight: 1.1,
                    }}
                  >
                    {money(value as number)}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>{note as string}</div>
                </Blueprint>
              ))}
            </div>

            <Blueprint style={{ padding: "14px 18px 18px" }}>
              <CostBreakdown
                projectName={project.name}
                trades={bids.map((b) => ({
                  id: b.id,
                  shortId: b.shortId,
                  trade: b.trade,
                  status: b.status,
                  invited: b.invited,
                  received: b.received,
                  low: b.low,
                  avg: b.avg,
                  high: b.high,
                  awardedPrice: b.awardedPrice,
                  awardedCompany: b.awardedCompany,
                  lowCompany: b.lowCompany,
                  quotes: b.quotes,
                }))}
                totals={costTotals}
              />
            </Blueprint>
          </div>
        )}

        {/* ── FILES ── */}
        {tab === "files" && (
          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 12px" }}>Drawings &amp; files</h4>
            <ProjectFiles
              shortId={project.short_id}
              files={(files ?? []) as FileRow[]}
              canWrite={canWrite(user)}
            />
          </Blueprint>
        )}

        {/* ── ACTIVITY ── */}
        {tab === "activity" && (
          <Blueprint style={{ padding: 18, maxWidth: 720 }}>
            <h4 style={{ margin: "0 0 12px" }}>Activity</h4>
            {(activity ?? []).length === 0 ? (
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Nothing yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(activity ?? []).map((a) => (
                  <li key={a.id} style={{ padding: "9px 0", borderTop: HAIR }}>
                    <div style={{ fontSize: 14 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: FAINT }}>
                      {timeAgo(a.created_at)}
                      {a.meta ? ` · ${a.meta}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Blueprint>
        )}
      </div>
    </>
  );
}
