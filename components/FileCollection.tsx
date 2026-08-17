"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Trash2,
  ImageOff,
  FileImage,
  LayoutGrid,
  List,
  Download,
} from "lucide-react";
import FileViewer from "@/components/FileViewer";
import { formatBytes } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

export type CollectionFile = {
  id: string;
  name: string;
  kind: string;
  size_bytes?: number | null;
};

/**
 * HEIC is what an iPhone shoots by default and no browser but Safari will
 * draw it. These get a labelled tile so it's clear the photo is there and
 * simply can't be previewed here.
 */
const noPreview = (name: string) => /\.(heic|heif|tiff?|dwg|dxf)$/i.test(name);
const ICON = { doc: FileText, photo: ImageIcon, video: Video } as const;

/* ── one grid tile ── */
function Tile({
  file,
  portal,
  selected,
  square,
  selectable,
  onToggle,
  onOpen,
  onRemove,
}: {
  file: CollectionFile;
  portal: boolean;
  selected: boolean;
  square: boolean;
  selectable: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const previewable = file.kind === "photo" && !noPreview(file.name);

  useEffect(() => {
    if (!previewable) return;
    let live = true;
    fetch(portal ? `/api/portal/files/${file.id}` : `/api/files/${file.id}`)
      .then((r) => r.json())
      .then((d) => live && (d.url ? setUrl(d.url) : setFailed(true)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [file.id, previewable, portal]);

  const Icon = ICON[file.kind as keyof typeof ICON] ?? FileText;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onOpen}
        title={file.name}
        style={{
          display: "block",
          width: "100%",
          aspectRatio: square ? "1 / 1" : "4 / 3",
          padding: 0,
          border: selected
            ? "2px solid var(--color-accent)"
            : "1px solid var(--color-divider)",
          background: "var(--color-surface)",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {previewable && url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={file.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {previewable && !url && (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: MUTED }}>
            {failed ? <ImageOff size={20} /> : null}
          </div>
        )}

        {!previewable && (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              gap: 4,
              height: "100%",
              padding: 8,
              textAlign: "center",
              color: "var(--color-accent-700)",
            }}
          >
            {file.kind === "photo" ? <FileImage size={22} /> : <Icon size={24} />}
            <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {(file.name.split(".").pop() || "file").toUpperCase()}
            </span>
          </div>
        )}
      </button>

      {/* select box sits over the tile, top-left */}
      {selectable && <label
        style={{
          position: "absolute",
          top: 5,
          left: 5,
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
          padding: "2px 4px",
          display: "flex",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          className="chk"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${file.name}`}
        />
      </label>}

      {onRemove && (
        <button
          className="btn btn-ghost"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            padding: 4,
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
          }}
        >
          <Trash2 size={13} />
        </button>
      )}

      <div
        style={{
          fontSize: 11,
          color: MUTED,
          marginTop: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {file.name}
      </div>
    </div>
  );
}

export default function FileCollection({
  files,
  portal = false,
  defaultView = "list",
  storageKey,
  onRemove,
  empty = "Nothing here yet.",
  zipName = "files",
  square = false,
  columns,
  showToolbar = true,
}: {
  files: CollectionFile[];
  portal?: boolean;
  defaultView?: "grid" | "list";
  /** Remembers the chosen view per panel, so it survives a page change. */
  storageKey?: string;
  onRemove?: (id: string) => void;
  empty?: string;
  zipName?: string;
  /** Square tiles rather than 4:3 — reads better for a photo wall. */
  square?: boolean;
  /** Fixed number of columns instead of auto-fill. */
  columns?: number;
  /** Subs don't need select-and-zip; hide the toolbar for them. */
  showToolbar?: boolean;
}) {
  const [view, setView] = useState<"grid" | "list">(defaultView);
  const [picked, setPicked] = useState<string[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(`view:${storageKey}`);
    if (saved === "grid" || saved === "list") setView(saved);
  }, [storageKey]);

  const setViewMode = (next: "grid" | "list") => {
    setView(next);
    if (storageKey) localStorage.setItem(`view:${storageKey}`, next);
  };

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const allPicked = files.length > 0 && picked.length === files.length;
  const selectedSize = useMemo(
    () =>
      files
        .filter((f) => picked.includes(f.id))
        .reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
    [files, picked]
  );

  async function downloadSelected() {
    setBusy(true);
    setError(null);

    // One file doesn't need zipping — hand over the signed link.
    if (picked.length === 1) {
      const res = await fetch(
        portal ? `/api/portal/files/${picked[0]}` : `/api/files/${picked[0]}`
      );
      const data = await res.json();
      setBusy(false);
      if (res.ok) window.open(data.url, "_blank", "noopener");
      else setError(data.error || "Couldn't open that file.");
      return;
    }

    const res = await fetch("/api/files/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: picked, name: zipName }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't build that download.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${zipName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setPicked([]);
  }

  return (
    <>
      {showToolbar && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        {files.length > 0 && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                className="chk"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? [] : files.map((f) => f.id))}
              />
              {picked.length > 0 ? `${picked.length} selected` : "Select all"}
            </label>

            {picked.length > 0 && (
              <button className="btn btn-secondary" onClick={downloadSelected} disabled={busy}>
                <Download size={15} />
                {busy
                  ? "Preparing…"
                  : picked.length === 1
                    ? "Download"
                    : `Download ${picked.length}`}
                {selectedSize > 0 && (
                  <span style={{ color: MUTED }}> · {formatBytes(selectedSize)}</span>
                )}
              </button>
            )}
          </>
        )}

        {/* grid / list switch */}
        <div className="seg" style={{ marginLeft: "auto" }}>
          <label className="seg-opt" title="Grid">
            <input
              type="radio"
              name={`view-${storageKey ?? "files"}`}
              checked={view === "grid"}
              onChange={() => setViewMode("grid")}
            />
            <LayoutGrid size={14} />
          </label>
          <label className="seg-opt" title="List">
            <input
              type="radio"
              name={`view-${storageKey ?? "files"}`}
              checked={view === "list"}
              onChange={() => setViewMode("list")}
            />
            <List size={14} />
          </label>
        </div>
      </div>
      )}

      {error && <div style={{ fontSize: 12, color: "#b3261e", marginBottom: 8 }}>{error}</div>}

      {files.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{empty}</p>
      ) : view === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: columns
              ? `repeat(${columns}, minmax(0, 1fr))`
              : "repeat(auto-fill, minmax(120px, 1fr))",
            gap: columns ? 8 : 12,
          }}
        >
          {files.map((f, i) => (
            <Tile
              key={f.id}
              file={f}
              portal={portal}
              square={square}
              selectable={showToolbar}
              selected={picked.includes(f.id)}
              onToggle={() => toggle(f.id)}
              onOpen={() => setViewing(i)}
              onRemove={onRemove ? () => onRemove(f.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div>
          {files.map((f, i) => {
            const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
            return (
              <div
                key={f.id}
                style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: HAIR }}
              >
                <input
                  type="checkbox"
                  className="chk"
                  checked={picked.includes(f.id)}
                  onChange={() => toggle(f.id)}
                  aria-label={`Select ${f.name}`}
                />
                <Icon size={16} style={{ opacity: 0.6, flex: "none" }} />
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewing(i)}
                  style={{
                    padding: 0,
                    flex: 1,
                    minWidth: 0,
                    justifyContent: "flex-start",
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </button>
                <span style={{ fontSize: 11, color: FAINT, flex: "none" }}>
                  {formatBytes(f.size_bytes)}
                </span>
                {onRemove && (
                  <button
                    className="btn btn-ghost"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemove(f.id)}
                    style={{ flex: "none" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewing !== null && (
        <FileViewer files={files} index={viewing} onClose={() => setViewing(null)} portal={portal} />
      )}
    </>
  );
}
