import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil, Columns3, UserPlus } from "lucide-react";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, money, timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import Tabs from "@/components/Tabs";
import type { Comment } from "@/components/CommentsModal";
import SendAllButton from "./SendAllButton";
import {
  BidFilesPanel,
  CadenceBar,
  InvitationsTable,
  ResponseCards,
  type BidFile,
  type InviteRow,
  type ResponseCard,
} from "./BidTabs";

export const dynamic = "force-dynamic";

const TABS = [
  ["scope", "Scope"],
  ["subs", "Subs"],
  ["responses", "Responses"],
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

export default async function BidDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await requireUser();
  const supabase = createClient();
  const tab = searchParams.tab ?? "scope";

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "id, short_id, title, due_date, scope, cadence, status, created_at, awarded_sub_id, projects(short_id, name, city), trades(name)"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();

  const project = bid.projects as unknown as {
    short_id: number;
    name: string;
    city: string | null;
  } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  const [{ data: items }, { data: attached }, { data: invitations }, { data: activity }] =
    await Promise.all([
      supabase
        .from("bid_line_items")
        .select("id, description, detail, qty, unit")
        .eq("bid_id", bid.id)
        .order("position"),
      supabase
        .from("bid_files")
        .select("files(id, name, kind)")
        .eq("bid_id", bid.id)
        .order("position"),
      supabase
        .from("invitations")
        .select(
          "id, status, sent_at, viewed_at, reminders, decline_reason, sub_id, subs(short_id, company_name, contact_name, phone, sub_trades(trades(name))), responses(price, lead_time, exclusions, notes, submitted_at, file_id), comments(id, author_name, body, created_at)"
        )
        .eq("bid_id", bid.id),
      supabase
        .from("activity")
        .select("id, type, text, meta, created_at")
        .eq("bid_id", bid.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const files = ((attached ?? []) as unknown as { files: BidFile | null }[])
    .map((a) => a.files)
    .filter(Boolean) as BidFile[];

  type Row = {
    id: string;
    status: string;
    sent_at: string | null;
    viewed_at: string | null;
    reminders: number;
    decline_reason: string | null;
    sub_id: string;
    subs: {
      short_id: number;
      company_name: string;
      contact_name: string | null;
      phone: string | null;
      sub_trades: { trades: { name: string } | null }[];
    } | null;
    comments: Comment[] | null;
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

  const low = priced.length ? responseOf(priced[0])!.price! : null;
  const received = rows.filter((r) => responseOf(r)?.price != null).length;
  const quiet = rows.filter((r) => !r.viewed_at && r.status !== "Denied").length;

  const inviteRows: InviteRow[] = rows.map((r) => ({
    id: r.id,
    subShortId: r.subs?.short_id ?? 0,
    company: r.subs?.company_name ?? "—",
    trades:
      (r.subs?.sub_trades ?? [])
        .map((t) => t.trades?.name)
        .filter(Boolean)
        .join(", ") || "—",
    contact: r.subs?.contact_name ?? "—",
    phone: r.subs?.phone ?? "",
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    reminders: r.reminders ?? 0,
    status: r.status,
    detail:
      r.status === "Denied"
        ? r.decline_reason ?? "declined"
        : responseOf(r)?.price != null
          ? money(responseOf(r)!.price)
          : "",
  }));

  const cards: ResponseCard[] = priced.map((r, i) => {
    const resp = responseOf(r)!;
    const over = low != null ? (resp.price ?? 0) - low : 0;
    return {
      invitationId: r.id,
      subId: r.sub_id,
      company: r.subs?.company_name ?? "—",
      rank: i === 0 ? "Low bid" : `#${i + 1}`,
      price: resp.price ?? 0,
      delta: i === 0 ? "Lowest price received" : `${money(over)} over low`,
      notes: resp.notes,
      exclusions: resp.exclusions,
      leadTime: resp.lead_time,
      submittedAt: resp.submitted_at,
      fileId: resp.file_id,
      comments: (r.comments ?? []) as Comment[],
      awarded: bid.awarded_sub_id === r.sub_id,
    };
  });

  const facts: [string, string][] = [
    ["Due", formatDate(bid.due_date)],
    ["Reminders", bid.cadence],
    ["Invited", String(rows.length)],
    ["Priced", `${received} of ${rows.length}`],
    ["Low bid", low != null ? money(low) : "—"],
    ["Created", timeAgo(bid.created_at)],
  ];

  const canEdit = canWrite(user) && bid.status !== "Awarded";

  return (
    <>
      <header
        className="pagehead"
        style={{ padding: "18px 28px 0", borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link className="btn btn-ghost" href={`/projects/${project?.short_id}`} style={{ paddingLeft: 0 }}>
          ← {project?.name}
        </Link>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          <div style={{ marginRight: "auto", minWidth: 0 }}>
            <h1 style={{ fontSize: 30, margin: 0 }}>{trade?.name ?? "Bid package"}</h1>
            <div style={{ fontSize: 13, color: MUTED }}>
              {project?.name} · due {formatDate(bid.due_date)} · {received} of {rows.length} priced
            </div>
          </div>
          <span className="tag tag-accent" style={{ marginBottom: 6 }}>
            {bid.status}
          </span>

          {canEdit && (
            <Link className="btn btn-secondary" href={`/bids/${bid.short_id}/edit`}>
              <Pencil size={15} /> Edit bid
            </Link>
          )}
          {canEdit && quiet + (rows.length - received - quiet) > 0 && (
            <SendAllButton quietCount={rows.length - received} />
          )}
          {rows.length > 0 && (
            <Link className="btn btn-secondary" href={`/bids/${bid.short_id}/compare`}>
              <Columns3 size={15} /> Compare
            </Link>
          )}
          {canEdit && (
            <Link className="btn btn-primary blueprint" href={`/bids/${bid.short_id}/invite`}>
              <UserPlus size={15} /> Invite subs
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
        {/* ── SCOPE ── */}
        {tab === "scope" && (
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
              <h4 style={{ margin: "0 0 10px" }}>Scope of work</h4>
              <div style={{ fontSize: 14, maxWidth: "70ch", whiteSpace: "pre-line", textWrap: "pretty" }}>
                {bid.scope || "No scope written yet."}
              </div>

              {(items ?? []).length > 0 ? (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-divider)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <h4 style={{ margin: 0 }}>Pricing lines</h4>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>
                      Every sub prices these same lines
                    </span>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>#</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items ?? []).map((i, n) => (
                        <tr key={i.id}>
                          <td style={{ color: "color-mix(in srgb, var(--color-text) 45%, transparent)", verticalAlign: "top" }}>
                            {n + 1}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{i.description}</div>
                            {i.detail && (
                              <div
                                style={{
                                  fontSize: 13,
                                  whiteSpace: "pre-line",
                                  color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
                                  marginTop: 2,
                                  maxWidth: "70ch",
                                }}
                              >
                                {i.detail}
                              </div>
                            )}
                          </td>
                          <td className="tabular" style={{ textAlign: "right", verticalAlign: "top" }}>
                            {i.qty ?? ""} {i.unit ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: "1px solid var(--color-divider)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 13, color: MUTED }}>
                    Lump sum — no pricing lines defined.
                  </span>
                  {canEdit && (
                    <Link className="btn btn-ghost" href={`/bids/${bid.short_id}/edit`}>
                      Add pricing lines
                    </Link>
                  )}
                </div>
              )}

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid var(--color-divider)",
                  display: "flex",
                  gap: 26,
                  flexWrap: "wrap",
                }}
              >
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <div style={label}>{k}</div>
                    <div style={{ fontSize: 14 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Blueprint>

            <Blueprint style={{ padding: 18 }}>
              <BidFilesPanel shortId={bid.short_id} files={files} canWrite={canEdit} />
            </Blueprint>
          </div>
        )}

        {/* ── SUBS ── */}
        {tab === "subs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Blueprint
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
            >
              <CadenceBar
                shortId={bid.short_id}
                cadence={bid.cadence}
                note={
                  quiet > 0
                    ? `${quiet} still hasn't opened it`
                    : rows.length
                      ? "Everyone has opened it"
                      : "Nobody invited yet"
                }
                canWrite={canEdit}
              />
            </Blueprint>

            <Blueprint style={{ padding: "12px 18px 6px" }}>
              <InvitationsTable rows={inviteRows} canWrite={canWrite(user)} />
            </Blueprint>
          </div>
        )}

        {/* ── RESPONSES ── */}
        {tab === "responses" && (
          <ResponseCards
            bidShortId={bid.short_id}
            cards={cards}
            canWrite={canWrite(user)}
            awarded={!!bid.awarded_sub_id}
          />
        )}

        {/* ── ACTIVITY ── */}
        {tab === "activity" && (
          <Blueprint style={{ padding: "16px 18px 18px", maxWidth: 820 }}>
            {(activity ?? []).length === 0 ? (
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Nothing yet.</p>
            ) : (
              (activity ?? []).map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: HAIR }}>
                  <span
                    className="tag tag-neutral"
                    style={{ flex: "none", width: 88, justifyContent: "center" }}
                  >
                    {a.type}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: FAINT }}>
                      {timeAgo(a.created_at)}
                      {a.meta ? ` · ${a.meta}` : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Blueprint>
        )}
      </div>
    </>
  );
}
