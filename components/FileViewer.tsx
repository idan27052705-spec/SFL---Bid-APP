"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { formatBytes } from "@/lib/format";

export type ViewerFile = {
  id: string;
  name: string;
  kind: string;
  size_bytes?: number | null;
};

/**
 * Full-screen file viewer.
 *
 * Photos and video play inline; anything else (PDF, spreadsheet, DWG)
 * gets an embedded frame with a download link, because browsers can't
 * preview everything. Arrow keys and Escape work, and the next/previous
 * buttons walk the same list you clicked from — so you can flick through
 * a set of site photos without going back to the page each time.
 */
export default function FileViewer({
  files,
  index,
  onClose,
  portal = false,
}: {
  files: ViewerFile[];
  index: number;
  onClose: () => void;
  /** Portal uses its own endpoint, which checks the sub was invited. */
  portal?: boolean;
}) {
  const [at, setAt] = useState(index);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const file = files[at];

  const step = useCallback(
    (d: number) => setAt((i) => (i + d + files.length) % files.length),
    [files.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setUrl(null);

    fetch(portal ? `/api/portal/files/${file.id}` : `/api/files/${file.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.url) setUrl(d.url);
        else setError(d.error || "Couldn't open that file.");
      })
      .catch(() => live && setError("Couldn't open that file."))
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [file.id, portal]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "color-mix(in srgb, var(--color-accent-900) 97%, transparent)",
        padding: 20,
        gap: 14,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--color-bg)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 18,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </div>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.7 }}>
            {file.kind === "photo" ? "Photo" : file.kind === "video" ? "Video" : "Document"} ·{" "}
            {at + 1} of {files.length}
            {file.size_bytes ? ` · ${formatBytes(file.size_bytes)}` : ""}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {url && (
            <a
              className="btn btn-secondary"
              href={url}
              target="_blank"
              rel="noopener"
              style={{ color: "var(--color-bg)", borderColor: "color-mix(in srgb, #f2f2f3 40%, transparent)" }}
            >
              <Download size={15} /> Download
            </a>
          )}
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ color: "var(--color-bg)", borderColor: "color-mix(in srgb, #f2f2f3 40%, transparent)" }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* stage */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 12,
        }}
      >
        {files.length > 1 && (
          <button
            className="btn btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous"
            style={{ color: "var(--color-bg)", flex: "none" }}
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          {loading && <div style={{ color: "var(--color-bg)", fontSize: 14 }}>Opening…</div>}

          {error && (
            <div style={{ color: "var(--color-bg)", fontSize: 14 }}>{error}</div>
          )}

          {url && !loading && file.kind === "photo" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={file.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          )}

          {url && !loading && file.kind === "video" && (
            <video src={url} controls style={{ maxWidth: "100%", maxHeight: "100%" }} />
          )}

          {url && !loading && file.kind !== "photo" && file.kind !== "video" && (
            <iframe
              src={url}
              title={file.name}
              style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
            />
          )}
        </div>

        {files.length > 1 && (
          <button
            className="btn btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next"
            style={{ color: "var(--color-bg)", flex: "none" }}
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
