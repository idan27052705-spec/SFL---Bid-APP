"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import Modal from "@/components/Modal";
import ProjectModal, { type ProjectFields } from "../ProjectModal";
import { PROJECT_STAGES } from "@/app/config";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

/**
 * Stage picker, Edit and Archive for one project.
 *
 * Archiving is a stage, not a delete — the project, its bids, prices and
 * paper trail all stay exactly where they are. It just drops out of the
 * working list.
 */
export default function ProjectActions({
  shortId,
  name,
  status,
  fields,
}: {
  shortId: number;
  name: string;
  status: string;
  fields: ProjectFields;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [stage, setStage] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archived = status === "Archived";

  async function setStatus(next: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Couldn't change the stage.");
      setStage(status);
      return;
    }
    setStage(next);
    setArchiving(false);
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          className="input"
          style={{ width: 168 }}
          value={stage}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Project stage"
        >
          {PROJECT_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <button className="btn btn-secondary" onClick={() => setEditing(true)}>
          <Pencil size={15} /> Edit
        </button>

        {archived ? (
          <button className="btn btn-secondary" onClick={() => setStatus("Review")} disabled={busy}>
            <ArchiveRestore size={15} /> Unarchive
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => setArchiving(true)}>
            <Archive size={15} /> Archive
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#b3261e", width: "100%" }}>{error}</div>
      )}

      {editing && (
        <ProjectModal
          mode="edit"
          shortId={shortId}
          initial={fields}
          onClose={() => setEditing(false)}
        />
      )}

      {archiving && (
        <Modal
          title={`Archive ${name}?`}
          onClose={() => setArchiving(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setArchiving(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => setStatus("Archived")} disabled={busy}>
                {busy ? "Archiving…" : "Archive it"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            It drops out of your projects list and stops appearing on the
            dashboard. Nothing is deleted — the bids, the prices and the whole
            history stay exactly as they are.
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            You can bring it back any time from the Archived filter.
          </p>
        </Modal>
      )}
    </>
  );
}
