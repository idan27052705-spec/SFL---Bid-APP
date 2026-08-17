"use client";

import { useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Video } from "lucide-react";
import { formatBytes, timeAgo } from "@/lib/format";
import FileViewer from "@/components/FileViewer";
import { uploadFile } from "@/lib/uploadFile";

export type FileRow = {
  id: string;
  name: string;
  size_bytes: number | null;
  kind: string;
  created_at: string;
};

const ICON = { doc: FileText, photo: ImageIcon, video: Video } as const;

export default function ProjectFiles({
  shortId,
  files,
  canWrite,
}: {
  shortId: number;
  files: FileRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);

    for (const file of Array.from(list)) {
      const result = await uploadFile(file, { projectShortId: shortId }, (s) =>
        setStage(s === "converting" ? `Converting ${file.name}…` : `Uploading ${file.name}…`)
      );
      if (!result.ok) {
        setError(`${file.name}: ${result.error}`);
        break;
      }
    }
    setStage(null);

    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete that file.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {canWrite && (
        <div>
          <input
            ref={input}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files)}
          />
          <button
            className="btn btn-primary"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Upload files"}
          </button>
          <span className="text-muted" style={{ fontSize: 12, marginLeft: 10 }}>
            {stage ?? "Drawings, specs, site photos or walkthrough video."}
          </span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 14 }}>
          No files yet. Subs see everything you upload here when you attach it to
          a bid.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => {
              const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
              return (
                <tr key={f.id}>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 0, gap: 8 }}
                      onClick={() => setViewing(files.indexOf(f))}
                    >
                      <Icon size={15} />
                      {f.name}
                    </button>
                  </td>
                  <td className="text-muted">{formatBytes(f.size_bytes)}</td>
                  <td className="text-muted">{timeAgo(f.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    {canWrite && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => setDeleting({ id: f.id, name: f.name })}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {viewing !== null && (
        <FileViewer files={files} index={viewing} onClose={() => setViewing(null)} />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this file?"
          danger
          confirmLabel="Delete file"
          busyLabel="Deleting…"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const id = deleting.id;
            setDeleting(null);
            await remove(id);
          }}
          body={
            <>
              <b>{deleting.name}</b> is removed from this project for good. Any
              sub already looking at it loses it too.
            </>
          }
        />
      )}
    </div>
  );
}
