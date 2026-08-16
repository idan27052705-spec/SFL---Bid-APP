"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Video } from "lucide-react";
import { formatBytes } from "@/lib/format";

const ICON = { doc: FileText, photo: ImageIcon, video: Video } as const;

export default function BidFileList({
  files,
}: {
  files: { id: string; name: string; size_bytes: number | null; kind: string }[];
}) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setOpening(id);
    setError(null);
    const res = await fetch(`/api/files/${id}`);
    const data = await res.json();
    setOpening(null);
    if (res.ok) window.open(data.url, "_blank", "noopener");
    else setError(data.error || "Couldn't open that file.");
  }

  if (files.length === 0)
    return (
      <p className="text-muted" style={{ fontSize: 14 }}>
        No drawings attached to this package.
      </p>
    );

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {error && <div style={{ fontSize: 13, color: "#b3261e" }}>{error}</div>}
      {files.map((f) => {
        const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
        return (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              padding: "6px 0",
              borderBottom:
                "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
            }}
          >
            <button
              className="btn btn-ghost"
              style={{ padding: 0, gap: 8, flex: 1, justifyContent: "flex-start" }}
              onClick={() => open(f.id)}
              disabled={opening === f.id}
            >
              <Icon size={15} />
              {opening === f.id ? "Opening…" : f.name}
            </button>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {formatBytes(f.size_bytes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
