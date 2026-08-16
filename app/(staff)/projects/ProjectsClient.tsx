"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NewProjectModal from "./NewProjectModal";
import { formatDate } from "@/lib/format";

export type ProjectRow = {
  id: string;
  short_id: number;
  name: string;
  client: string | null;
  city: string | null;
  county: string | null;
  type: string | null;
  status: string;
  start_date: string | null;
  bidCount: number;
};

const STATUSES = ["All", "Bidding", "Awarded", "Draft", "Closed"];

export default function ProjectsClient({
  projects,
  canWrite,
}: {
  projects: ProjectRow[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [modal, setModal] = useState(false);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "All" && p.status !== status) return false;
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
              {projects.length} project{projects.length === 1 ? "" : "s"}
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
            {STATUSES.map((s) => (
              <button
                key={s}
                className="btn"
                onClick={() => setStatus(s)}
                style={{
                  border: 0,
                  borderLeft:
                    s === STATUSES[0] ? 0 : "1px solid var(--color-divider)",
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
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>Bids</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <NewProjectModal onClose={() => setModal(false)} />}
    </>
  );
}
