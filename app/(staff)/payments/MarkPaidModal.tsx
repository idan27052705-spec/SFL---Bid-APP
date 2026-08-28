"use client";

import { useEffect, useRef, useState } from "react";
import { Clipboard, FileText, Trash2 } from "lucide-react";
import Modal, { ModalField } from "@/components/Modal";
import { money, formatBytes } from "@/lib/format";
import { today } from "@/lib/dates";
import { dayLabel } from "@/lib/weeks";
import { MUTED } from "./sheet";
import type { PaymentRow, ProofFile } from "@/lib/payments";

/** A pasted screenshot usually arrives with no useful name of its own. */
function nameFor(file: File, row: PaymentRow): string {
  if (file.name && file.name !== "image.png") return file.name;
  const who = (row.payTo || row.projectName || "payment")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const ext = file.type.split("/")[1] || "png";
  return `proof-${who}-${row.date}.${ext}`;
}

/**
 * Marking a payment as gone out, with the evidence.
 *
 * The evidence is nearly always a screenshot of the bank confirmation, and
 * the person doing it has just pressed PrtSc — so Ctrl+V is the first
 * thing offered and the paste listener is on the whole dialog, not on one
 * focused box. Dropping a file and browsing for one work too, but they are
 * the fallbacks, not the headline.
 */
export default function MarkPaidModal({
  payment,
  onConfirm,
  onClose,
}: {
  payment: PaymentRow;
  onConfirm: (details: {
    paidAt: string;
    reference: string;
    proof: ProofFile | null;
  }) => void;
  onClose: () => void;
}) {
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<ProofFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [justPasted, setJustPasted] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  function attach(file: File) {
    setProof((old) => {
      // The old preview URL is dead the moment it's replaced.
      if (old) URL.revokeObjectURL(old.url);
      return {
        name: nameFor(file, payment),
        sizeBytes: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      };
    });
  }

  function clearProof() {
    setProof((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  }

  /**
   * Paste is caught on the document, so it works wherever the cursor
   * happens to be — including inside the reference box. Text pastes fall
   * straight through to whatever is focused.
   */
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        attach(file);
        setJustPasted(true);
        return;
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);

  /** A preview the caller never kept is a leak; drop it on the way out. */
  useEffect(() => {
    return () => {
      if (!saved.current && proof) URL.revokeObjectURL(proof.url);
    };
  }, [proof]);

  useEffect(() => {
    if (!justPasted) return;
    const t = setTimeout(() => setJustPasted(false), 1800);
    return () => clearTimeout(t);
  }, [justPasted]);

  function confirm() {
    saved.current = true;
    onConfirm({ paidAt, reference: reference.trim(), proof });
    onClose();
  }

  const isImage = proof?.type.startsWith("image/");

  return (
    <Modal
      title="Mark as paid"
      subtitle={`${money(payment.amount)} to ${payment.payTo || "—"} · ${payment.reason}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={confirm}>
            Mark as paid
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: MUTED }}>
        Scheduled for {dayLabel(payment.date)} · {payment.projectName}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField
          id="paid-date"
          label="Date paid"
          type="date"
          value={paidAt}
          onChange={setPaidAt}
        />
        <ModalField
          id="paid-reference"
          label="Reference"
          value={reference}
          onChange={setReference}
          placeholder="Wire / cheque no."
        />
      </div>

      <div className="field">
        <label htmlFor="proof-zone">Proof of payment</label>

        {proof ? (
          <div
            style={{
              border: "1px solid var(--color-divider)",
              padding: 10,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.url}
                alt={proof.name}
                style={{
                  width: 92,
                  height: 68,
                  objectFit: "cover",
                  border: "1px solid var(--color-divider)",
                  flex: "none",
                }}
              />
            ) : (
              <FileText size={28} style={{ flex: "none", color: MUTED }} />
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {proof.name}
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>
                {formatBytes(proof.sizeBytes)}
                {justPasted && " · pasted"}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                <a
                  className="btn btn-ghost"
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: 0, fontSize: 12 }}
                >
                  View
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={() => fileInput.current?.click()}
                  style={{ padding: 0, fontSize: 12 }}
                >
                  Replace
                </button>
              </div>
            </div>

            <button
              className="btn btn-ghost"
              onClick={clearProof}
              aria-label="Remove attachment"
              style={{ color: "#b3261e", flex: "none" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <div
            id="proof-zone"
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) attach(file);
            }}
            style={{
              border: `1px dashed ${
                dragging ? "var(--color-accent)" : "var(--color-divider)"
              }`,
              background: dragging
                ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                : "transparent",
              padding: "18px 14px",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <Clipboard size={18} style={{ color: "var(--color-accent)" }} />
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Take a screenshot and press <strong>Ctrl+V</strong>
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
              or drop a file here, or click to browse
            </div>
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) attach(file);
            e.target.value = "";
          }}
        />

        {!proof && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            Optional — but a paid row without proof is flagged in the report.
          </div>
        )}
      </div>
    </Modal>
  );
}
