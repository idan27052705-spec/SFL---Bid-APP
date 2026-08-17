"use client";

import { useEffect, useState } from "react";
import { Video, Trash2, ImageOff, FileImage } from "lucide-react";
import FileViewer from "@/components/FileViewer";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export type MediaFile = {
  id: string;
  name: string;
  kind: string;
  size_bytes?: number | null;
};

/**
 * HEIC is what an iPhone shoots by default, and no browser except Safari
 * will draw it. Rather than a blank tile, these get a labelled placeholder
 * so it's obvious the photo IS there and just can't be previewed here.
 */
const noPreview = (name: string) => /\.(heic|heif|tiff?|dwg|dxf)$/i.test(name);

/**
 * Photos and video as an actual gallery.
 *
 * The bucket is private, so a thumbnail can't just point at a URL — each
 * tile asks for its own short-lived signed link on mount. Videos show a
 * placeholder tile rather than loading the whole file just to draw a
 * thumbnail, which would cost a sub their data plan.
 */
function Thumb({
  file,
  portal,
  onOpen,
  onRemove,
}: {
  file: MediaFile;
  portal: boolean;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (file.kind !== "photo" || noPreview(file.name)) return;
    let live = true;
    fetch(portal ? `/api/portal/files/${file.id}` : `/api/files/${file.id}`)
      .then((r) => r.json())
      .then((d) => live && (d.url ? setUrl(d.url) : setFailed(true)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [file.id, file.kind, file.name, portal]);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onOpen}
        title={file.name}
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "4 / 3",
          padding: 0,
          border: "1px solid var(--color-divider)",
          background: "var(--color-surface)",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {file.kind === "photo" && noPreview(file.name) && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              gap: 4,
              color: "var(--color-accent-700)",
              padding: 8,
              textAlign: "center",
            }}
          >
            <FileImage size={22} />
            <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {(file.name.split(".").pop() || "").toUpperCase()}
            </span>
          </div>
        )}

        {file.kind === "photo" && !noPreview(file.name) && url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={file.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {file.kind === "photo" && !noPreview(file.name) && !url && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: MUTED,
            }}
          >
            {failed ? <ImageOff size={20} /> : null}
          </div>
        )}

        {file.kind !== "photo" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              gap: 6,
              color: "var(--color-accent-700)",
            }}
          >
            <Video size={26} />
          </div>
        )}
      </button>

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

      {onRemove && (
        <button
          className="btn btn-ghost"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            padding: 4,
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
          }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

export default function MediaGallery({
  files,
  portal = false,
  onRemove,
  empty = "No photos or video yet.",
}: {
  files: MediaFile[];
  portal?: boolean;
  onRemove?: (id: string) => void;
  empty?: string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);

  if (files.length === 0)
    return (
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{empty}</p>
    );

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 12,
        }}
      >
        {files.map((f, i) => (
          <Thumb
            key={f.id}
            file={f}
            portal={portal}
            onOpen={() => setViewing(i)}
            onRemove={onRemove ? () => onRemove(f.id) : undefined}
          />
        ))}
      </div>

      {viewing !== null && (
        <FileViewer
          files={files}
          index={viewing}
          onClose={() => setViewing(null)}
          portal={portal}
        />
      )}
    </>
  );
}
