"use client";

import { useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { DANGER, MUTED } from "./sheet";
import type { ProofFile } from "@/lib/payments";

/**
 * Opening one piece of evidence.
 *
 * The bucket is private, so there is no link straight to the object: the
 * route hands back a signed URL that lives ten minutes, and a plain
 * <a href> to it would show the reader a page of JSON. So this asks the
 * route first and then goes — the same two steps FileViewer takes for a
 * bid file, minus the gallery, because a proof is opened one at a time
 * from a table cell.
 *
 * The tab is opened before the fetch, not after. A window.open that
 * happens a network round trip after the click is not a click any more as
 * far as the browser is concerned, and the popup blocker eats it.
 *
 * A proof that has not been saved yet — a screenshot still sitting in the
 * mark-paid dialog — has no id and no route. Its object URL is already a
 * real link, so it stays an anchor.
 */
export default function ProofLink({
  file,
  label,
  size = 12,
}: {
  file: ProofFile;
  label: string;
  size?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: size,
  };

  const inner = (
    <>
      <Icon size={size + 1} /> {opening ? "Opening…" : label}
    </>
  );

  if (!file.id)
    return (
      <a
        className="rowlink"
        href={file.url}
        target="_blank"
        rel="noreferrer"
        title={file.name}
        style={style}
      >
        {inner}
      </a>
    );

  async function open() {
    setError(null);
    setOpening(true);
    // "noopener" would make window.open hand back null, and there would
    // be nothing left to point at the signed URL — so the reference is
    // taken and the opener cut by hand instead.
    const tab = window.open("about:blank", "_blank");
    try {
      if (tab) tab.opener = null;
      const res = await fetch(`/api/payments/proofs/${file.id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url)
        throw new Error(data?.error || "Couldn't open that file.");
      if (tab) tab.location.href = data.url;
      else window.location.href = data.url;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <button
        className="rowlink"
        onClick={open}
        disabled={opening}
        title={file.name}
        style={{
          ...style,
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          color: opening ? MUTED : undefined,
        }}
      >
        {inner}
      </button>
      {error && <span style={{ fontSize: 11, color: DANGER }}>{error}</span>}
    </>
  );
}
