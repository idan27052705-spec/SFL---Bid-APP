import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, timeAgo } from "@/lib/format";
import ProjectFiles, { type FileRow } from "./ProjectFiles";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("short_id", Number(params.id))
    .single();

  if (!project) notFound();

  const [{ data: bids }, { data: files }, { data: activity }] = await Promise.all([
    supabase
      .from("bids")
      .select("id, short_id, title, status, due_date, trades(name)")
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
      .limit(20),
  ]);

  const facts = [
    ["Client", project.client],
    ["Type", project.type],
    ["Address", project.address],
    ["City", project.city ? `${project.city}${project.county ? ` · ${project.county}` : ""}` : null],
    ["Start date", project.start_date ? formatDate(project.start_date) : null],
  ] as const;

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h6 className="text-muted">
              <Link href="/projects" className="rowlink">
                Projects
              </Link>
            </h6>
            <h1 style={{ marginBottom: 6 }}>{project.name}</h1>
            <span
              className={
                project.status === "Awarded"
                  ? "tag tag-accent"
                  : project.status === "Bidding"
                    ? "tag tag-outline"
                    : "tag tag-neutral"
              }
            >
              {project.status}
            </span>
          </div>
          {canWrite(user) && (
            <Link className="btn btn-primary" href={`/projects/${project.short_id}/bids/new`}>
              New bid package
            </Link>
          )}
        </div>
      </div>

      <div
        className="pagebody cols"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 22 }}
      >
        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <section>
            <h5>Bid packages</h5>
            {(bids ?? []).length === 0 ? (
              <p className="text-muted" style={{ fontSize: 14 }}>
                No bid packages yet. A bid package is one trade — plumbing,
                electrical, framing — that you send out for pricing.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th>Package</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(bids ?? []).map((b) => {
                    const trade = b.trades as unknown as { name: string } | null;
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link className="rowlink" href={`/bids/${b.short_id}`}>
                            <strong>{trade?.name ?? "—"}</strong>
                          </Link>
                        </td>
                        <td>{b.title}</td>
                        <td>{formatDate(b.due_date)}</td>
                        <td>
                          <span className="tag tag-neutral">{b.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h5>Drawings &amp; files</h5>
            <ProjectFiles
              shortId={project.short_id}
              files={(files ?? []) as FileRow[]}
              canWrite={canWrite(user)}
            />
          </section>

          {project.description && (
            <section>
              <h5>Description</h5>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                {project.description}
              </p>
            </section>
          )}
        </div>

        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <div className="card">
            <div className="card-kicker">Details</div>
            <dl style={{ margin: 0, display: "grid", gap: 10, fontSize: 14 }}>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt
                    className="text-muted"
                    style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}
                  >
                    {label}
                  </dt>
                  <dd style={{ margin: 0 }}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
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
