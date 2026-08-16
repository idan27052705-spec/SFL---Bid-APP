import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, timeAgo } from "@/lib/format";
import BidFileList from "./BidFileList";

export const dynamic = "force-dynamic";

const statusTag = (status: string) =>
  status === "Awarded"
    ? "tag tag-accent"
    : status === "Out for Bid" || status === "Responses In"
      ? "tag tag-outline"
      : "tag tag-neutral";

export default async function BidDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "id, short_id, title, due_date, scope, cadence, status, created_at, projects(short_id, name, city), trades(name)"
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
        .select("files(id, name, size_bytes, kind)")
        .eq("bid_id", bid.id)
        .order("position"),
      supabase
        .from("invitations")
        .select("id, status, sent_at, viewed_at, subs(company_name)")
        .eq("bid_id", bid.id),
      supabase
        .from("activity")
        .select("id, text, meta, created_at")
        .eq("bid_id", bid.id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const files = ((attached ?? []) as unknown as {
    files: { id: string; name: string; size_bytes: number | null; kind: string } | null;
  }[])
    .map((a) => a.files)
    .filter(Boolean) as {
    id: string;
    name: string;
    size_bytes: number | null;
    kind: string;
  }[];

  const invited = invitations ?? [];
  const isDraft = bid.status === "Draft";

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h6 className="text-muted">
              <Link className="rowlink" href={`/projects/${project?.short_id}`}>
                {project?.name}
              </Link>
            </h6>
            <h1 style={{ marginBottom: 6 }}>{trade?.name ?? "Bid package"}</h1>
            <div style={{ fontSize: 15 }}>{bid.title}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className={statusTag(bid.status)}>{bid.status}</span>
              <span className="tag tag-neutral">Due {formatDate(bid.due_date)}</span>
              <span className="tag tag-neutral">Reminders: {bid.cadence}</span>
            </div>
          </div>

          {canWrite(user) && (
            <div style={{ display: "flex", gap: 8 }}>
              {bid.status !== "Awarded" && (
                <Link className="btn btn-secondary" href={`/bids/${bid.short_id}/edit`}>
                  Edit package
                </Link>
              )}
              {invited.length > 0 && (
                <Link className="btn btn-secondary" href={`/bids/${bid.short_id}/compare`}>
                  Compare
                </Link>
              )}
              {bid.status !== "Awarded" && (
                <Link className="btn btn-primary" href={`/bids/${bid.short_id}/invite`}>
                  {invited.length ? "Invite more subs" : "Invite subs"}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="pagebody cols"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 22 }}
      >
        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          {isDraft && (
            <div
              className="card"
              style={{
                borderColor: "var(--color-accent)",
                background: "color-mix(in srgb, var(--color-accent) 7%, transparent)",
              }}
            >
              <div className="card-title">This package is still a draft</div>
              <p className="card-body">
                Nobody has been invited yet, so no sub can see it. When the scope
                reads right, invite subs and it goes out for pricing.
              </p>
            </div>
          )}

          <section>
            <h5>Scope of work</h5>
            {bid.scope ? (
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{bid.scope}</p>
            ) : (
              <p className="text-muted" style={{ fontSize: 14 }}>
                No scope written yet.{" "}
                {canWrite(user) && (
                  <Link href={`/bids/${bid.short_id}/edit`}>Add it</Link>
                )}
              </p>
            )}
          </section>

          {(items ?? []).length > 0 && (
            <section>
              <h5>Line items</h5>
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ width: 90 }}>Qty</th>
                    <th style={{ width: 110 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.description}
                        {i.detail && (
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {i.detail}
                          </div>
                        )}
                      </td>
                      <td>{i.qty ?? "—"}</td>
                      <td>{i.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h5>Drawings &amp; specs</h5>
            <BidFileList files={files} />
          </section>
        </div>

        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <div className="card">
            <div className="card-kicker">Subs invited</div>
            {invited.length === 0 ? (
              <p className="card-body">
                Nobody invited yet. Reminders and responses show up here once the
                package goes out.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 14 }}>
                {invited.map((iv) => {
                  const sub = iv.subs as unknown as { company_name: string } | null;
                  return (
                    <li
                      key={iv.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: "7px 0",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>{sub?.company_name}</span>
                      <span className="tag tag-neutral">{iv.status}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card-kicker">Activity</div>
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
      </div>
    </>
  );
}
