"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Video } from "lucide-react";
import { formatBytes, timeAgo } from "@/lib/format";

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
  const [opening, setOpening] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);

    for (const file of Array.from(list)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/projects/${shortId}/files`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(`${file.name}: ${data.error || "Upload failed."}`);
        break;
      }
    }

    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function open(id: string) {
    setOpening(id);
    const res = await fetch(`/api/files/${id}`);
    const data = await res.json();
    setOpening(null);
    if (res.ok) window.open(data.url, "_blank", "noopener");
    else setError(data.error || "Couldn't open that file.");
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
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
            Drawings, specs, site photos or walkthrough video. Up to 50 MB each.
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
                      onClick={() => open(f.id)}
                      disabled={opening === f.id}
                    >
                      <Icon size={15} />
                      {opening === f.id ? "Opening…" : f.name}
                    </button>
                  </td>
                  <td className="text-muted">{formatBytes(f.size_bytes)}</td>
                  <td className="text-muted">{timeAgo(f.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    {canWrite && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => remove(f.id, f.name)}
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
    </div>
  );
}
