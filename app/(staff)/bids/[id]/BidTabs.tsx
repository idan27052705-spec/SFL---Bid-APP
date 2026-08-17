"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Video,
  FilePlus,
  FileSearch,
  MessageSquare,
} from "lucide-react";
import { REMINDER_CADENCES } from "@/app/config";
import { money, timeAgo } from "@/lib/format";
import CommentsModal, { type Comment } from "@/components/CommentsModal";
import FileCollection from "@/components/FileCollection";
import { uploadFile } from "@/lib/uploadFile";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";

export type BidFile = { id: string; name: string; kind: string; size_bytes?: number | null };

/* ── Attached files panel, with the three upload buttons ── */
export function BidFilesPanel({
  shortId,
  projectShortId,
  files,
  canWrite,
}: {
  shortId: number;
  projectShortId: number;
  files: BidFile[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const docs = files.filter((f) => f.kind === "doc");

  /** accept set on the node, not via state — see BidBuilder for why. */
  const pick = (kind: "doc" | "photo" | "video") => {
    const el = input.current;
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

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    for (const f of Array.from(list)) {
      const result = await uploadFile(
        f,
        { projectShortId, bidShortId: shortId },
        (s) => setStage(s === "converting" ? `Converting ${f.name}…` : `Uploading ${f.name}…`)
      );
      if (!result.ok) {
        setError(`${f.name}: ${result.error}`);
        break;
      }
    }
    setBusy(false);
    setStage(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <>
      <h4 style={{ margin: "0 0 10px" }}>Drawings &amp; specs</h4>

      <FileCollection
        files={docs}
        defaultView="list"
        storageKey="bid-docs"
        zipName="Drawings and specs"
        empty="No drawings attached yet. Subs see whatever you put here."
      />

      {error && <div style={{ fontSize: 12, color: "#b3261e", marginTop: 8 }}>{error}</div>}

      {canWrite && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files)}
          />
          <button
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => pick("doc")}
          >
            <FilePlus size={15} /> Add drawing or spec
          </button>
          {stage && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{stage}</div>}
        </>
      )}

    </>
  );
}

/* ── Photos & video gallery, sits under the pricing lines ── */
export function BidMediaPanel({
  shortId,
  projectShortId,
  media,
  canWrite,
}: {
  shortId: number;
  projectShortId: number;
  media: BidFile[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  const pick = (kind: "photo" | "video") => {
    const el = input.current;
    if (!el) return;
    el.accept = kind === "photo" ? "image/*" : "video/*";
    el.value = "";
    el.click();
  };

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    for (const f of Array.from(list)) {
      const result = await uploadFile(
        f,
        { projectShortId, bidShortId: shortId },
        (s) => setStage(s === "converting" ? `Converting ${f.name}…` : `Uploading ${f.name}…`)
      );
      if (!result.ok) {
        setError(`${f.name}: ${result.error}`);
        break;
      }
    }
    setBusy(false);
    setStage(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>Photos &amp; video</h4>
        {canWrite && (
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => pick("photo")}>
              <ImageIcon size={15} /> Photo
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => pick("video")}>
              <Video size={15} /> Video
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        What the site actually looks like. Saves a sub a trip when they price
        from a phone.
      </div>

      <input
        ref={input}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files)}
      />

      <FileCollection
        files={media}
        defaultView="grid"
        storageKey="bid-media"
        zipName="Photos and video"
        empty="No photos or video on this package."
      />

      {stage && <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>{stage}</div>}
      {error && <div style={{ fontSize: 12, color: "#b3261e", marginTop: 10 }}>{error}</div>}
    </>
  );
}

/* ── Reminder cadence bar ── */
export function CadenceBar({
  shortId,
  cadence,
  note,
  canWrite,
}: {
  shortId: number;
  cadence: string;
  note: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cadence);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    setValue(next);
    setSaving(true);
    await fetch(`/api/bids/${shortId}/cadence`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cadence: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <div>
        <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: FAINT }}>
          Reminder cadence
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          Stops automatically on a price, a decline, or an award
        </div>
      </div>
      <select
        className="input"
        style={{ width: 170 }}
        value={value}
        disabled={!canWrite || saving}
        onChange={(e) => change(e.target.value)}
      >
        {REMINDER_CADENCES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>{note}</div>
    </>
  );
}

/* ── Invitations table ── */
export type InviteRow = {
  id: string;
  subShortId: number;
  company: string;
  trades: string;
  contact: string;
  phone: string;
  sentAt: string | null;
  viewedAt: string | null;
  reminders: number;
  status: string;
  detail: string;
};

export function InvitationsTable({
  rows,
  canWrite,
}: {
  rows: InviteRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(id: string, what: "resend" | "remove" | "preview", subShortId?: number) {
    setBusy(id);
    setMsg(null);

    if (what === "preview") {
      const res = await fetch(`/api/subs/${subShortId}/preview`, { method: "POST" });
      setBusy(null);
      if (res.ok) window.open("/portal/bids", "_blank", "noopener");
      else setMsg("Couldn't open the preview.");
      return;
    }

    const res = await fetch(
      what === "resend" ? `/api/invitations/${id}/resend` : `/api/invitations/${id}`,
      { method: what === "resend" ? "POST" : "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? (what === "resend" ? "Reminder sent." : "Removed.") : data.error);
    router.refresh();
  }

  return (
    <>
      {msg && <div style={{ fontSize: 13, padding: "0 0 8px", color: MUTED }}>{msg}</div>}
      <div className="tablewrap">
        <table className="table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Sub</th>
              <th>Contact</th>
              <th>Sent</th>
              <th>Viewed</th>
              <th>Reminders</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: MUTED }}>
                  Nobody invited yet.
                </td>
              </tr>
            ) : (
              rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link className="rowlink" href={`/subs/${i.subShortId}`} style={{ fontWeight: 500 }}>
                      {i.company}
                    </Link>
                    <div style={{ fontSize: 12, color: MUTED }}>{i.trades}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {i.contact}
                    <div style={{ fontSize: 11, color: FAINT }}>{i.phone}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{i.sentAt ? timeAgo(i.sentAt) : "—"}</td>
                  <td style={{ fontSize: 13 }}>{i.viewedAt ? timeAgo(i.viewedAt) : "never"}</td>
                  <td style={{ fontSize: 13 }}>{i.reminders}</td>
                  <td>
                    <span className="tag tag-accent">{i.status}</span>
                    <div style={{ fontSize: 11, color: FAINT }}>{i.detail}</div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {canWrite && (
                      <>
                        <button
                          className="btn btn-ghost"
                          disabled={busy === i.id}
                          onClick={() => act(i.id, "preview", i.subShortId)}
                        >
                          Preview as sub
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={busy === i.id}
                          onClick={() => act(i.id, "resend")}
                        >
                          Send again
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={busy === i.id}
                          onClick={() => act(i.id, "remove")}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Response cards ── */
export type ResponseCard = {
  invitationId: string;
  subId: string;
  company: string;
  rank: string;
  price: number;
  delta: string;
  notes: string | null;
  exclusions: string | null;
  leadTime: string | null;
  submittedAt: string | null;
  fileId: string | null;
  comments: Comment[];
  awarded: boolean;
};

export function ResponseCards({
  bidShortId,
  cards,
  canWrite,
  awarded,
}: {
  bidShortId: number;
  cards: ResponseCard[];
  canWrite: boolean;
  awarded: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<ResponseCard | null>(null);

  async function openFile(id: string) {
    const res = await fetch(`/api/files/${id}`);
    const data = await res.json();
    if (res.ok) window.open(data.url, "_blank", "noopener");
    else setError(data.error || "Couldn't open that file.");
  }

  async function award(subId: string, company: string) {
    if (!confirm(`Award this package to ${company}? Reminders stop for everyone.`)) return;
    setBusy(subId);
    const res = await fetch(`/api/bids/${bidShortId}/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subId }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) setError(data.error);
    router.refresh();
  }

  async function deny(invitationId: string) {
    const reason = prompt("Why are you ruling this one out?");
    if (!reason?.trim()) return;
    setBusy(invitationId);
    const res = await fetch(`/api/invitations/${invitationId}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) setError(data.error);
    router.refresh();
  }

  if (cards.length === 0)
    return (
      <p style={{ fontSize: 14, color: MUTED }}>
        No prices yet. They appear here the moment a sub sends one.
      </p>
    );

  return (
    <>
      {error && <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 12 }}>{error}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))",
          gap: 18,
        }}
      >
        {cards.map((r) => (
          <div
            key={r.invitationId}
            className="blueprint"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: r.awarded
                ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 18,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {r.company}
              </div>
              <span className={r.awarded ? "tag tag-accent" : "tag tag-outline"}>
                {r.awarded ? "Awarded" : r.rank}
              </span>
            </div>

            <div
              className="tabular"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, lineHeight: 1 }}
            >
              {money(r.price)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{r.delta}</div>

            {r.notes && <div style={{ fontSize: 13, marginTop: 4 }}>{r.notes}</div>}
            <div style={{ fontSize: 12, color: MUTED }}>
              Exclusions: {r.exclusions || "none stated"}
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              Lead time: {r.leadTime || "—"} · submitted{" "}
              {r.submittedAt ? timeAgo(r.submittedAt) : "—"}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {r.fileId && (
                <button className="btn btn-secondary" onClick={() => openFile(r.fileId!)}>
                  <FileSearch size={15} /> Their quote
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setNotesFor(r)}>
                <MessageSquare size={15} />
                {r.comments.length > 0 ? `Notes (${r.comments.length})` : "Notes"}
              </button>
              {canWrite && !awarded && (
                <>
                  <button
                    className="btn btn-secondary"
                    disabled={busy === r.invitationId}
                    onClick={() => deny(r.invitationId)}
                  >
                    Deny
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ marginLeft: "auto" }}
                    disabled={busy === r.subId}
                    onClick={() => award(r.subId, r.company)}
                  >
                    Award
                  </button>
                </>
              )}
            </div>

            <i className="corner tl" />
            <i className="corner tr" />
            <i className="corner bl" />
            <i className="corner br" />
          </div>
        ))}
      </div>

      {notesFor && (
        <CommentsModal
          invitationId={notesFor.invitationId}
          company={notesFor.company}
          initial={notesFor.comments}
          canWrite={canWrite}
          onClose={() => setNotesFor(null)}
        />
      )}
    </>
  );
}
