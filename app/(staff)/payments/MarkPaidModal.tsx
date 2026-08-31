"use client";

import { useEffect, useRef, useState } from "react";
import { Clipboard, FileText, Trash2 } from "lucide-react";
import Modal, { ModalField } from "@/components/Modal";
import SelectField from "./SelectField";
import { money, formatBytes } from "@/lib/format";
import { today } from "@/lib/dates";
import { MUTED } from "./sheet";
import {
  PAYMENT_METHODS,
  dayOrAny,
  type PaymentMethod,
  type PaymentRow,
  type ProofFile,
} from "@/lib/payments";

/** A pasted screenshot usually arrives with no useful name of its own. */
function nameFor(file: File, row: PaymentRow): string {
  if (file.name && file.name !== "image.png") return file.name;
  const who = (row.payTo || row.projectName || "payment")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const ext = file.type.split("/")[1] || "png";
  // No day on the row means the week is the best date the name can carry.
  return `proof-${who}-${row.date ?? row.weekStart}.${ext}`;
}

/**
 * Two screenshots pasted one after the other are both called the same
 * thing, and a list of identical names is a list you cannot read. The
 * second one becomes "…-2".
 */
function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.includes(`${stem}-${n}${ext}`)) n++;
  return `${stem}-${n}${ext}`;
}

/**
 * Marking a payment as gone out, with the evidence.
 *
 * The evidence is nearly always a screenshot of the bank confirmation, and
 * the person doing it has just pressed PrtSc — so Ctrl+V is the first
 * thing offered and the paste listener is on the whole dialog, not on one
 * focused box. Dropping a file and browsing for one work too, but they are
 * the fallbacks, not the headline.
 *
 * Files add up rather than replace each other. One payment often has a
 * confirmation and the invoice it settles, and losing the first attachment
 * to the second is the kind of thing nobody notices until the row is being
 * queried months later.
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
    method: PaymentMethod | null;
    proofs: ProofFile[];
  }) => void;
  onClose: () => void;
}) {
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const [proofs, setProofs] = useState<ProofFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [justPasted, setJustPasted] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  /** Everything attached so far, for the cleanup that runs on the way out. */
  const attached = useRef<ProofFile[]>([]);
  useEffect(() => {
    attached.current = proofs;
  }, [proofs]);

  function attach(files: File[]) {
    if (!files.length) return;
    // The object URLs are made here, outside the state updater, so a
    // double-invoked updater can never mint a second one nobody revokes.
    const incoming = files.map((file) => ({
      name: nameFor(file, payment),
      sizeBytes: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    setProofs((list) => {
      const taken = list.map((p) => p.name);
      return [
        ...list,
        ...incoming.map((p) => {
          const name = uniqueName(p.name, taken);
          taken.push(name);
          return { ...p, name };
        }),
      ];
    });
  }

  /** That one preview is dead the moment its row leaves the list. */
  function removeProof(url: string) {
    setProofs((list) => list.filter((p) => p.url !== url));
    URL.revokeObjectURL(url);
  }

  /**
   * Paste is caught on the document, so it works wherever the cursor
   * happens to be — including inside the reference box. Text pastes fall
   * straight through to whatever is focused.
   *
   * One paste can carry several files, so every item is read: stopping at
   * the first would silently drop the rest of a multi-file copy.
   */
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);
      if (!files.length) return;
      e.preventDefault();
      attach(files);
      setJustPasted(files.length);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);

  /** Previews the caller never kept are a leak; drop them on the way out. */
  useEffect(() => {
    return () => {
      if (saved.current) return;
      attached.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  useEffect(() => {
    if (!justPasted) return;
    const t = setTimeout(() => setJustPasted(0), 1800);
    return () => clearTimeout(t);
  }, [justPasted]);

  function confirm() {
    saved.current = true;
    onConfirm({
      paidAt,
      reference: reference.trim(),
      method: method || null,
      proofs,
    });
    onClose();
  }

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
        Scheduled for {dayOrAny(payment.date)} · {payment.projectName}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField
          id="paid-date"
          label="Date paid"
          type="date"
          value={paidAt}
          onChange={setPaidAt}
        />
        {/*
          How it went out is worth a second to record and impossible to
          reconstruct later — but it is a select, not a required field: a
          payment nobody can classify still has to be markable as paid.
        */}
        <SelectField
          id="paid-method"
          label="Payment method"
          value={method}
          onChange={(v) => setMethod(v as PaymentMethod | "")}
          placeholder="How was it paid?"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
        />
      </div>

      <ModalField
        id="paid-reference"
        label="Reference"
        value={reference}
        onChange={setReference}
        placeholder="Wire / cheque no."
      />

      <div className="field">
        <label htmlFor="proof-zone">Proof of payment</label>

        {proofs.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            {proofs.map((p) => (
              <div
                key={p.url}
                style={{
                  border: "1px solid var(--color-divider)",
                  padding: "6px 8px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                {p.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.name}
                    style={{
                      width: 52,
                      height: 38,
                      objectFit: "cover",
                      border: "1px solid var(--color-divider)",
                      flex: "none",
                    }}
                  />
                ) : (
                  <FileText size={22} style={{ flex: "none", color: MUTED }} />
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>
                    {formatBytes(p.sizeBytes)}
                  </div>
                </div>

                <a
                  className="btn btn-ghost"
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: 0, fontSize: 12, flex: "none" }}
                >
                  View
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={() => removeProof(p.url)}
                  aria-label={`Remove ${p.name}`}
                  style={{ color: "#b3261e", flex: "none" }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* The zone never goes away — the next file is always one paste off. */}
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
            attach(Array.from(e.dataTransfer.files ?? []));
          }}
          style={{
            border: `1px dashed ${
              dragging ? "var(--color-accent)" : "var(--color-divider)"
            }`,
            background: dragging
              ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
              : "transparent",
            padding: proofs.length ? "10px 12px" : "18px 14px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <Clipboard
            size={proofs.length ? 15 : 18}
            style={{ color: "var(--color-accent)" }}
          />
          {proofs.length ? (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              Paste or drop to add another
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Take a screenshot and press <strong>Ctrl+V</strong>
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                or drop a file here, or click to browse
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            attach(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {justPasted > 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--color-accent-700)",
              marginTop: 4,
            }}
          >
            {justPasted} file{justPasted === 1 ? "" : "s"} pasted
          </div>
        ) : proofs.length === 0 ? (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            Optional — but a paid row without proof is flagged in the report.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
