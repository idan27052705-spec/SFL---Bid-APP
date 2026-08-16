"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STR, type Lang } from "@/lib/portalStrings";
import { money } from "@/lib/format";
import FileViewer from "@/components/FileViewer";

type Existing = {
  price: number | null;
  lead_time: string | null;
  exclusions: string | null;
  notes: string | null;
} | null;

export default function BidActions({
  shortId,
  lang,
  existing,
  declinedReason,
  closed,
  files,
}: {
  shortId: number;
  lang: Lang;
  existing: Existing;
  declinedReason: string | null;
  closed: boolean;
  files: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = STR[lang];
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"none" | "quote" | "decline">("none");
  const [price, setPrice] = useState(existing?.price ? String(existing.price) : "");
  const [lead, setLead] = useState(existing?.lead_time ?? "");
  const [exclusions, setExclusions] = useState(existing?.exclusions ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  async function sendQuote() {
    setError(null);
    if (!price.replace(/[^\d.]/g, "")) {
      setError(t.priceRequired);
      return;
    }

    setBusy(true);
    const body = new FormData();
    body.append("price", price);
    body.append("lead", lead);
    body.append("exclusions", exclusions);
    body.append("notes", notes);
    body.append("lang", lang);
    const f = fileInput.current?.files?.[0];
    if (f) body.append("file", f);

    const res = await fetch(`/api/portal/bids/${shortId}/response`, {
      method: "POST",
      body,
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Couldn't send.");
      return;
    }
    setDone(data.message || t.sentOk);
    setMode("none");
    router.refresh();
  }

  async function sendDecline() {
    setError(null);
    if (!reason.trim()) {
      setError(t.reasonRequired);
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/portal/bids/${shortId}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, lang }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Couldn't send.");
      return;
    }
    setDone(data.message || t.declinedOk);
    setMode("none");
    router.refresh();
  }

  const big = { minHeight: 48, fontSize: 16 } as const;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {files.length > 0 && (
        <section>
          <h5>{t.files}</h5>
          <div style={{ display: "grid", gap: 8 }}>
            {files.map((f) => (
              <button
                key={f.id}
                className="btn btn-secondary"
                style={{ ...big, justifyContent: "space-between" }}
                onClick={() => setViewing(files.indexOf(f))}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {t.download}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {done && (
        <div
          className="card"
          style={{
            borderColor: "var(--color-accent)",
            background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
            fontSize: 15,
          }}
        >
          {done}
        </div>
      )}

      {declinedReason && (
        <div className="card" style={{ fontSize: 14 }}>
          <div className="card-kicker">{t.youSaid}</div>
          {declinedReason}
        </div>
      )}

      {existing?.price != null && (
        <div className="card" style={{ gap: 6 }}>
          <div className="card-kicker">{t.yourPrice}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 30 }}>
            {money(existing.price)}
          </div>
          {existing.lead_time && (
            <div style={{ fontSize: 14 }}>
              {t.lead}: {existing.lead_time}
            </div>
          )}
          {existing.exclusions && (
            <div style={{ fontSize: 14 }}>
              {t.excl}: {existing.exclusions}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 14, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      {/* ── the one big button ── */}
      {!closed && mode === "none" && (
        <div style={{ display: "grid", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ ...big, minHeight: 54 }}
            onClick={() => setMode("quote")}
          >
            {existing?.price != null ? t.yourPrice : t.submitQuote}
          </button>
          {existing?.price == null && !declinedReason && (
            <button
              className="btn btn-ghost"
              style={big}
              onClick={() => setMode("decline")}
            >
              {t.cantBid}
            </button>
          )}
        </div>
      )}

      {mode === "quote" && (
        <div className="card" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="price">{t.total}</label>
            <input
              id="price"
              className="input"
              style={{ ...big, fontSize: 22 }}
              inputMode="decimal"
              placeholder="$0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError(null);
              }}
            />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 5 }}>
              {t.totalHint}
            </div>
          </div>

          <div className="field">
            <label htmlFor="lead">{t.lead}</label>
            <input
              id="lead"
              className="input"
              style={big}
              placeholder={t.leadHint}
              value={lead}
              onChange={(e) => setLead(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="excl">{t.excl}</label>
            <textarea
              id="excl"
              className="input"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
            />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 5 }}>
              {t.exclHint}
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">{t.notes}</label>
            <textarea
              id="notes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <input
              ref={fileInput}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <button
              className="btn btn-secondary"
              style={big}
              onClick={() => fileInput.current?.click()}
            >
              {fileName ? `${t.attached}: ${fileName}` : t.attach}
            </button>
          </div>

          <button
            className="btn btn-primary"
            style={{ ...big, minHeight: 54 }}
            onClick={sendQuote}
            disabled={busy}
          >
            {busy ? t.sending : t.send}
          </button>
          <button className="btn btn-ghost" onClick={() => setMode("none")} disabled={busy}>
            {t.cancel}
          </button>
        </div>
      )}

      {viewing !== null && (
        <FileViewer
          files={files.map((f) => ({ ...f, kind: "doc" }))}
          index={viewing}
          onClose={() => setViewing(null)}
          portal
        />
      )}

      {mode === "decline" && (
        <div className="card" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="reason">{t.why}</label>
            <textarea
              id="reason"
              className="input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 5 }}>
              {t.whyHint}
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={big}
            onClick={sendDecline}
            disabled={busy}
          >
            {busy ? t.sending : t.sendDecline}
          </button>
          <button className="btn btn-ghost" onClick={() => setMode("none")} disabled={busy}>
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
