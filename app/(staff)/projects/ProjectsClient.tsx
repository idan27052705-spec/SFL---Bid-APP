"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Archive, ArchiveRestore } from "lucide-react";
import ProjectModal, { type ProjectFields } from "./ProjectModal";
import ConfirmModal from "@/components/ConfirmModal";
import RowMenu from "@/components/RowMenu";
import { PROJECT_STAGES } from "@/app/config";
import { formatDate } from "@/lib/format";

export type ProjectRow = {
  id: string;
  short_id: number;
  name: string;
  client: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  type: string | null;
  status: string;
  start_date: string | null;
  description: string | null;
  bidCount: number;
};

/** "All" deliberately excludes Archived — you have to ask for those. */
const FILTERS = ["All", ...PROJECT_STAGES];

const fieldsOf = (p: ProjectRow): ProjectFields => ({
  name: p.name ?? "",
  client: p.client ?? "",
  address: p.address ?? "",
  city: p.city ?? "",
  county: p.county ?? "Broward",
  type: p.type ?? "",
  startDate: p.start_date ?? "",
  description: p.description ?? "",
});

export default function ProjectsClient({
  projects,
  canWrite,
}: {
  projects: ProjectRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [archiving, setArchiving] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Archiving is a stage, not a delete — the project, its bids, its
   * prices and its paper trail all stay put. It just drops out of the
   * working list, and Archived brings it back.
   */
  async function setStage(p: ProjectRow, next: string) {
    setError(null);
    const res = await fetch(`/api/projects/${p.short_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't change that project's stage.");
      return;
    }
    router.refresh();
  }

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status === "All" ? p.status === "Archived" : p.status !== status) return false;
      if (!s) return true;
      return [p.name, p.client, p.city, p.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [projects, search, status]);

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h6 className="text-muted">Projects</h6>
            <h1 style={{ marginBottom: 0 }}>
              {projects.filter((p) => p.status !== "Archived").length} project
              {projects.filter((p) => p.status !== "Archived").length === 1 ? "" : "s"}
            </h1>
          </div>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              New project
            </button>
          )}
        </div>
      </div>

      <div className="pagebody">
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search projects, clients, cities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="seg" style={{ display: "inline-flex" }}>
            {FILTERS.map((s) => (
              <button
                key={s}
                className="btn"
                onClick={() => setStatus(s)}
                style={{
                  border: 0,
                  borderLeft:
                    s === FILTERS[0] ? 0 : "1px solid var(--color-divider)",
                  background:
                    status === s
                      ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                      : "transparent",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 28, alignItems: "flex-start" }}>
            <div className="card-title">
              {projects.length === 0 ? "No projects yet" : "Nothing matches that"}
            </div>
            <p className="card-body">
              {projects.length === 0
                ? "Create your first project, then build bid packages inside it and send them to subs."
                : "Try a different search or status filter."}
            </p>
            {projects.length === 0 && canWrite && (
              <button className="btn btn-primary" onClick={() => setModal(true)}>
                New project
              </button>
            )}
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>Bids</th>
                  <th>Stage</th>
                  {canWrite && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="clickrow"
                    onClick={(e) => {
                      // Anywhere in the row opens the project — except the
                      // things that already do something of their own.
                      if ((e.target as HTMLElement).closest("a, button, input, select"))
                        return;
                      router.push(`/projects/${p.short_id}`);
                    }}
                  >
                    <td>
                      <Link className="rowlink" href={`/projects/${p.short_id}`}>
                        <strong>{p.name}</strong>
                      </Link>
                    </td>
                    <td>{p.client || "—"}</td>
                    <td>
                      {p.city || "—"}
                      {p.county ? (
                        <span className="text-muted"> · {p.county}</span>
                      ) : null}
                    </td>
                    <td>{p.type || "—"}</td>
                    <td>{formatDate(p.start_date)}</td>
                    <td>{p.bidCount}</td>
                    <td>
                      <span
                        className={
                          p.status === "Awarded"
                            ? "tag tag-accent"
                            : p.status === "Bidding"
                              ? "tag tag-outline"
                              : "tag tag-neutral"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    {canWrite && (
                      <td style={{ textAlign: "right", width: 44 }}>
                        <RowMenu
                          label={`Actions for ${p.name}`}
                          actions={[
                            {
                              label: "View project",
                              icon: <Eye size={14} />,
                              onSelect: () => router.push(`/projects/${p.short_id}`),
                            },
                            {
                              label: "Edit project",
                              icon: <Pencil size={14} />,
                              onSelect: () => setEditing(p),
                            },
                            p.status === "Archived"
                              ? {
                                  label: "Unarchive project",
                                  icon: <ArchiveRestore size={14} />,
                                  onSelect: () => setStage(p, "New"),
                                }
                              : {
                                  label: "Archive project",
                                  icon: <Archive size={14} />,
                                  danger: true,
                                  onSelect: () => setArchiving(p),
                                },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="pagebody" style={{ paddingTop: 0, fontSize: 13, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      {modal && <ProjectModal mode="new" onClose={() => setModal(false)} />}

      {editing && (
        <ProjectModal
          mode="edit"
          shortId={editing.short_id}
          initial={fieldsOf(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      {archiving && (
        <ConfirmModal
          title="Archive this project?"
          confirmLabel="Archive project"
          busyLabel="Archiving…"
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            const p = archiving;
            setArchiving(null);
            await setStage(p, "Archived");
          }}
          body={
            <>
              <b>{archiving.name}</b> drops out of the working list. Nothing is
              deleted — the bids, the prices and the history all stay, and you
              can bring it back from the Archived filter whenever you want.
            </>
          }
        />
      )}
    </>
  );
}
