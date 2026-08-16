"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus } from "lucide-react";
import { REMINDER_CADENCES } from "@/app/config";
import { formatBytes } from "@/lib/format";

export type BuilderTrade = { id: string; name: string };
export type BuilderFile = {
  id: string;
  name: string;
  size_bytes: number | null;
  kind: string;
};
export type BuilderItem = {
  key: string;
  description: string;
  detail: string;
  qty: string;
  unit: string;
};

const UNITS = ["lot", "each", "sf", "lf", "cy", "sy", "floors", "openings", "fixtures", "hours"];

const newItem = (): BuilderItem => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  detail: "",
  qty: "1",
  unit: "lot",
});

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

  const [tradeId, setTradeId] = useState(initial?.tradeId ?? trades[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [scope, setScope] = useState(initial?.scope ?? "");
  const [cadence, setCadence] = useState(initial?.cadence ?? "Every 2 days");
  const [items, setItems] = useState<BuilderItem[]>(
    initial?.items?.length ? initial.items : [newItem()]
  );
  const [fileIds, setFileIds] = useState<string[]>(initial?.fileIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setItem = (key: string, field: keyof BuilderItem, value: string) =>
    setItems((list) =>
      list.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );

  const toggleFile = (id: string) =>
    setFileIds((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

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

    router.push(
      thenInvite
        ? `/bids/${data.bid.short_id}/invite`
        : `/bids/${data.bid.short_id}`
    );
    router.refresh();
  }

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">
          <Link className="rowlink" href={`/projects/${projectShortId}`}>
            {projectName}
          </Link>
        </h6>
        <h1 style={{ marginBottom: 4 }}>
          {mode === "new" ? "New bid package" : "Edit bid package"}
        </h1>
        <p className="text-muted" style={{ maxWidth: 620 }}>
          One package is one trade. Everything you put here is what the subs see
          in the portal.
        </p>
      </div>

      <div className="pagebody" style={{ display: "grid", gap: 22, maxWidth: 860 }}>
        {errors.form && (
          <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
            {errors.form}
          </div>
        )}

        {/* ── the basics ── */}
        <div className="card" style={{ gap: 14 }}>
          <div className="card-kicker">The basics</div>

          <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label htmlFor="trade">
                Trade<span style={{ color: "#b3261e" }}> *</span>
              </label>
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
              {errors.trade && (
                <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>
                  {errors.trade}
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="due">Bids due</label>
              <input
                id="due"
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="title">
              Package title<span style={{ color: "#b3261e" }}> *</span>
            </label>
            <input
              id="title"
              className="input"
              value={title}
              placeholder="Floors 4–18 rough-in and fixtures"
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((x) => ({ ...x, title: "" }));
              }}
              style={errors.title ? { borderColor: "#b3261e" } : undefined}
            />
            {errors.title && (
              <div style={{ fontSize: 12, color: "#b3261e", marginTop: 4 }}>
                {errors.title}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="scope">Scope of work</label>
            <textarea
              id="scope"
              className="input"
              style={{ minHeight: 160 }}
              value={scope}
              placeholder={
                "What's included, what's excluded, testing, as-builts, access restrictions…\n\nWrite it the way you'd say it on the phone. This is the first thing a sub reads."
              }
              onChange={(e) => setScope(e.target.value)}
            />
          </div>
        </div>

        {/* ── line items ── */}
        <div className="card" style={{ gap: 12 }}>
          <div className="card-kicker">Line items</div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: -6 }}>
            Optional. Break the package into pieces and subs can price each one —
            which makes bids far easier to compare side by side.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Description</th>
                  <th style={{ width: "25%" }}>Detail</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 120 }}>Unit</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key}>
                    <td>
                      <input
                        className="input"
                        value={i.description}
                        placeholder="Domestic water risers — floors 4–18"
                        onChange={(e) => setItem(i.key, "description", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        value={i.detail}
                        placeholder="optional note"
                        onChange={(e) => setItem(i.key, "detail", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        value={i.qty}
                        inputMode="decimal"
                        onChange={(e) => setItem(i.key, "qty", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="input"
                        value={i.unit}
                        onChange={(e) => setItem(i.key, "unit", e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label="Remove line"
                        onClick={() =>
                          setItems((l) =>
                            l.length === 1 ? [newItem()] : l.filter((x) => x.key !== i.key)
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setItems((l) => [...l, newItem()])}
            >
              <Plus size={15} /> Add line
            </button>
          </div>
        </div>

        {/* ── drawings ── */}
        <div className="card" style={{ gap: 12 }}>
          <div className="card-kicker">Drawings &amp; specs</div>
          {projectFiles.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              No files on this project yet.{" "}
              <Link href={`/projects/${projectShortId}`}>Upload them here</Link>,
              then come back and tick the ones this trade needs.
            </p>
          ) : (
            <>
              <div className="text-muted" style={{ fontSize: 13, marginTop: -6 }}>
                Tick what this trade needs. The same drawing can go on more than
                one package.
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {projectFiles.map((f) => (
                  <label
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="chk"
                      checked={fileIds.includes(f.id)}
                      onChange={() => toggleFile(f.id)}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{f.name}</span>
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      {formatBytes(f.size_bytes)}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── reminders ── */}
        <div className="card" style={{ gap: 12 }}>
          <div className="card-kicker">Chasing subs</div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="cadence">Remind subs who haven&apos;t priced</label>
            <select
              id="cadence"
              className="input"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            >
              {REMINDER_CADENCES.filter((c) => c !== "Stopped").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Reminders stop by themselves the moment a sub sends a price, says they
            can&apos;t bid, or you award the package.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={busy}>
            {busy ? "Saving…" : "Save and invite subs"}
          </button>
          <button className="btn btn-secondary" onClick={() => save(false)} disabled={busy}>
            Save as draft
          </button>
          <Link
            className="btn btn-ghost"
            href={bidShortId ? `/bids/${bidShortId}` : `/projects/${projectShortId}`}
          >
            Cancel
          </Link>
        </div>
      </div>
    </>
  );
}
