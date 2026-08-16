"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { timeAgo } from "@/lib/format";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

export type Comment = {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

/**
 * Internal notes on one sub's bid. Office only — the sub never sees
 * these, and there is no route that would let them.
 */
export default function CommentsModal({
  invitationId,
  company,
  initial,
  canWrite,
  onClose,
}: {
  invitationId: string;
  company: string;
  initial: Comment[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setComments(initial), [initial]);

  async function add() {
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invitations/${invitationId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save that note.");
      return;
    }
    setComments((c) => [...c, data.comment]);
    setText("");
  }

  return (
    <Modal
      title={`Notes on ${company}`}
      subtitle="Internal only — the sub never sees these."
      onClose={onClose}
      width={520}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      {comments.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
          No notes yet. Use this for the things you&apos;d say out loud in the
          office — who&apos;s reliable, what went wrong last time.
        </p>
      ) : (
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "9px 0", borderTop: HAIR }}>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c.body}</div>
              <div style={{ fontSize: 11, color: MUTED }}>
                {c.author_name ?? "Someone"} · {timeAgo(c.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <>
          <div className="field">
            <label htmlFor="note">Add a note</label>
            <textarea
              id="note"
              className="input"
              value={text}
              placeholder="Priced high but never misses a date…"
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: "#b3261e" }}>{error}</div>}
          <button className="btn btn-primary" onClick={add} disabled={busy}>
            {busy ? "Saving…" : "Save note"}
          </button>
        </>
      )}
    </Modal>
  );
}
