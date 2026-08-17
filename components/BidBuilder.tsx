"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus, FilePlus, Image as ImageIcon, Video, FileText } from "lucide-react";
import { REMINDER_CADENCES } from "@/app/config";
import { formatDate } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import MediaGallery from "@/components/MediaGallery";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";
const GRID = "26px minmax(0,1fr) 90px 110px 40px";
const ICON = { doc: FileText, photo: ImageIcon, video: Video } as const;

export type BuilderTrade = { id: string; name: string };
export type BuilderFile = { id: string; name: string; size_bytes: number | null; kind: string };
export type BuilderItem = {
  key: string;
  description: string;
  detail: string;
  qty: string;
  unit: string;
};

const newItem = (): BuilderItem => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  detail: "",
  qty: "1",
  unit: "lot",
});

/** Due-date shortcuts — most packages go out with one of these. */
const presets: [string, number][] = [
  ["In 5 days", 5],
  ["In 1 week", 7],
  ["In 2 weeks", 14],
  ["In 3 weeks", 21],
];

const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function BidBuilder({
  mode,
  projectShortId,
  projectName,
  bidShortId,
  trades,
  projectFiles,
  initial,
}: {
  mode: "new" | "edit";
  projectShortId: number;
  projectName: string;
  bidShortId?: number;
  trades: BuilderTrade[];
  projectFiles: BuilderFile[];
  initial?: {
    tradeId: string;
    title: string;
    dueDate: string;
    scope: string;
    cadence: string;
    items: BuilderItem[];
    fileIds: string[];
  };
}) {
  const router = useRouter();
  const upload = useRef<HTMLInputElement>(null);

  const [tradeId, setTradeId] = useState(initial?.tradeId ?? trades[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [scope, setScope] = useState(initial?.scope ?? "");
  const [cadence, setCadence] = useState(initial?.cadence ?? "Every 2 days");
  const [items, setItems] = useState<BuilderItem[]>(
    initial?.items?.length ? initial.items : [newItem()]
  );
  const [files, setFiles] = useState<BuilderFile[]>(projectFiles);
  const [fileIds, setFileIds] = useState<string[]>(initial?.fileIds ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setItem = (key: string, field: keyof BuilderItem, value: string) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, [field]: value } : i)));

  const attached = files.filter((f) => fileIds.includes(f.id));
  const attachedDocs = attached.filter((f) => f.kind === "doc");
  const attachedMedia = attached.filter((f) => f.kind === "photo" || f.kind === "video");
  const unattached = files.filter((f) => !fileIds.includes(f.id));
  const detach = (id: string) => setFileIds((p) => p.filter((x) => x !== id));

  /**
   * Set `accept` straight on the DOM node, then click.
   *
   * This used to go through React state with a setTimeout(0) click — the
   * click fired before React re-rendered, so the input still carried the
   * PREVIOUS filter. Click Photo then Drawing and every PDF was greyed
   * out in the file picker.
   */
  const pick = (kind: "doc" | "photo" | "video") => {
    const el = upload.current;
    if (!el) return;
    el.accept =
      kind === "photo"
        ? "image/*"
        : kind === "video"
          ? "video/*"
          : ".pdf,.dwg,.dxf,.xls,.xlsx,.doc,.docx,.csv,.txt,application/pdf";
    el.value = "";
    el.click();
  };

  async function onUpload(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    setUploadError(null);

    for (const f of Array.from(list)) {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch(`/api/projects/${projectShortId}/files`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        // A failed upload used to vanish silently.
        const data = await res.json().catch(() => ({}));
        setUploadError(`${f.name}: ${data.error || "upload failed"}`);
        break;
      }

      const { file } = await res.json();
      setFiles((prev) => [{ ...file, size_bytes: file.size_bytes ?? null }, ...prev]);
      setFileIds((prev) => [...prev, file.id]);
    }

    setUploading(false);
    if (upload.current) upload.current.value = "";
  }

  async function save(thenInvite: boolean) {
    const next: Record<string, string> = {};
    if (!tradeId) next.trade = "Pick a trade.";
    if (!title.trim()) next.title = "Give this package a title.";
    if (Object.keys(next).length) {
      setErrors(next);
      window.scrollTo(0, 0);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/bids/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bidShortId,
        projectShortId,
        tradeId,
        title: title.trim(),
        dueDate: dueDate || null,
        scope,
        cadence,
        items: items.map((i) => ({
          description: i.description,
          detail: i.detail,
          qty: i.qty,
          unit: i.unit,
        })),
        fileIds,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrors({ form: data.error || "Couldn't save. Try again." });
      window.scrollTo(0, 0);
      return;
    }

    router.push(thenInvite ? `/bids/${data.bid.short_id}/invite` : `/bids/${data.bid.short_id}`);
    router.refresh();
  }

  const filled = items.filter((i) => i.description.trim()).length;

  return (
    <>
      <header className="pagehead" style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}>
        <Link
          className="btn btn-ghost"
          href={bidShortId ? `/bids/${bidShortId}` : `/projects/${projectShortId}`}
          style={{ paddingLeft: 0 }}
        >
          ← Back
        </Link>
        <h1 style={{ fontSize: 30, margin: "4px 0 0" }}>
          {mode === "new" ? "New bid package" : "Edit bid package"}
        </h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          {projectName} · one project × one trade ·{" "}
          {filled === 0 ? "lump sum" : `${filled} pricing line${filled === 1 ? "" : "s"}`}
        </div>
      </header>

      <div
        className="pagebody cols"
        style={{
          padding: "26px 28px 40px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(300px,340px)",
          gap: 26,
          alignItems: "start",
        }}
      >
        {/* ── left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          {errors.form && (
            <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
              {errors.form}
            </div>
          )}

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 14px" }}>Details</h4>
            <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
              <div className="field">
                <label htmlFor="trade">Trade</label>
                <select
                  id="trade"
                  className="input"
                  value={tradeId}
                  onChange={(e) => {
                    setTradeId(e.target.value);
                    setErrors((x) => ({ ...x, trade: "" }));
                  }}
                  style={errors.trade ? { borderColor: "#b3261e" } : undefined}
                >
                  {trades.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="due">Due date</label>
                <input
                  id="due"
                  className="input"
                  type="date"
                  style={{ cursor: "pointer" }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  className="input"
                  placeholder="Floors 4–18 rough-in and fixtures"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((x) => ({ ...x, title: "" }));
                  }}
                  style={errors.title ? { borderColor: "#b3261e" } : undefined}
                />
                {errors.title && (
                  <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>{errors.title}</div>
                )}
              </div>
            </div>
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 6px" }}>Scope of work</h4>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
              Subs read this verbatim in the portal. State inclusions and
              exclusions plainly.
            </div>
            <textarea
              className="input"
              style={{ minHeight: 200 }}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            />
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <h4 style={{ margin: 0 }}>Pricing lines</h4>
              <button
                className="btn btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() => setItems((l) => [...l, newItem()])}
              >
                <Plus size={15} /> Add line
              </button>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              Every sub prices these same lines, so the comparison is apples to
              apples. Leave empty for a single lump-sum price.
            </div>

            <div
              className="pricelinehead"
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 8,
                alignItems: "center",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: FAINT,
                paddingBottom: 6,
              }}
            >
              <div>#</div>
              <div>Description</div>
              <div>Qty</div>
              <div>Unit</div>
              <div />
            </div>

            {items.map((i, n) => (
              <div key={i.key} style={{ padding: "10px 0", borderTop: HAIR }}>
                <div className="priceline" style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
                    {n + 1}
                  </div>
                  <input
                    className="input"
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}
                    placeholder="Headline — e.g. Domestic water risers"
                    value={i.description}
                    onChange={(e) => setItem(i.key, "description", e.target.value)}
                  />
                  <input
                    className="input"
                    inputMode="decimal"
                    value={i.qty}
                    onChange={(e) => setItem(i.key, "qty", e.target.value)}
                  />
                  <input
                    className="input"
                    value={i.unit}
                    onChange={(e) => setItem(i.key, "unit", e.target.value)}
                  />
                  <button
                    className="btn btn-ghost"
                    aria-label="Remove line"
                    onClick={() =>
                      setItems((l) => (l.length === 1 ? [newItem()] : l.filter((x) => x.key !== i.key)))
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="pricelinedetail" style={{ paddingLeft: 34, marginTop: 6 }}>
                  <textarea
                    className="input"
                    style={{ minHeight: 74 }}
                    placeholder="Long description for this line — inclusions, exclusions, materials, sequencing. Blank lines are kept."
                    value={i.detail}
                    onChange={(e) => setItem(i.key, "detail", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
              <h4 style={{ margin: 0 }}>Photos &amp; video</h4>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button className="btn btn-secondary" disabled={uploading} onClick={() => pick("photo")}>
                  <ImageIcon size={15} /> Photo
                </button>
                <button className="btn btn-secondary" disabled={uploading} onClick={() => pick("video")}>
                  <Video size={15} /> Video
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              Site photos and a walkthrough video save a trip for subs pricing
              from a phone.
            </div>

            <MediaGallery
              files={attachedMedia}
              onRemove={detach}
              empty="No photos or video yet. Add some and they appear here as thumbnails."
            />

            {uploading && <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Uploading…</div>}
          </Blueprint>
        </div>

        {/* ── right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 4px" }}>Drawings &amp; specs</h4>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
              Plan sets, specifications, schedules. Photos and video go in
              their own gallery under the pricing lines.
            </div>

            {attachedDocs.length === 0 && (
              <p style={{ fontSize: 13, color: MUTED, margin: "8px 0 0" }}>
                Nothing attached yet.
              </p>
            )}

            {attachedDocs.map((f) => {
              const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
              return (
                <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: HAIR }}>
                  <Icon size={16} style={{ opacity: 0.6, flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.name}
                  </div>
                  <button className="btn btn-ghost" onClick={() => detach(f.id)}>
                    Remove
                  </button>
                </div>
              );
            })}

            {unattached.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: MUTED, cursor: "pointer" }}>
                  {unattached.length} more file{unattached.length === 1 ? "" : "s"} on this project
                </summary>
                {unattached.map((f) => (
                  <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: HAIR }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{f.name}</div>
                    <button className="btn btn-ghost" onClick={() => setFileIds((p) => [...p, f.id])}>
                      Attach
                    </button>
                  </div>
                ))}
              </details>
            )}

            <input
              ref={upload}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => onUpload(e.target.files)}
            />
            <button
              className="btn btn-secondary btn-block"
              disabled={uploading}
              onClick={() => pick("doc")}
            >
              <FilePlus size={15} /> Add drawing or spec
            </button>
            {uploading && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Uploading…</div>}
            {uploadError && (
              <div style={{ fontSize: 12, color: "#b3261e", marginTop: 8 }}>{uploadError}</div>
            )}
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 6px" }}>Due date</h4>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
              The date pricing is due back. Reminders stop after it passes.
            </div>
            <input
              className="input"
              type="date"
              style={{ minHeight: 44, fontSize: 16, cursor: "pointer" }}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Due back:{" "}
              <span style={{ fontWeight: 500 }}>
                {dueDate ? formatDate(dueDate) : "not set"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {presets.map(([label, days]) => (
                <button
                  key={label}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setDueDate(isoIn(days))}
                >
                  {label}
                </button>
              ))}
            </div>
          </Blueprint>

          <Blueprint style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 6px" }}>Reminders</h4>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
              Stops on a price, a decline, or an award.
            </div>
            <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              {REMINDER_CADENCES.filter((c) => c !== "Stopped").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Blueprint>

          <Blueprint style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              onClick={() => save(true)}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save and invite subs"}
            </button>
            <button className="btn btn-secondary" onClick={() => save(false)} disabled={busy}>
              Save as draft
            </button>
          </Blueprint>
        </div>
      </div>
    </>
  );
}
