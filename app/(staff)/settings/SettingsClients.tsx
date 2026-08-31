"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import Modal, { ModalField } from "@/components/Modal";
import NotConnected from "@/components/NotConnected";
import { REMINDER_CADENCES } from "@/app/config";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

/* ══════════════ TRADES ══════════════ */
export function TradesEditor({
  trades,
  canWrite,
}: {
  trades: { id: string; name: string; bids: number; subs: number }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDraft("");
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/settings/trades?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {canWrite && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            className="input"
            placeholder="New trade name"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button className="btn btn-primary" onClick={add} disabled={busy}>
            Add
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 8 }}>{error}</div>}

      {trades.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: HAIR }}>
          <div style={{ flex: 1, fontSize: 14 }}>{t.name}</div>
          <div style={{ fontSize: 12, color: FAINT }}>
            {t.bids === 0 && t.subs === 0
              ? "not used yet"
              : [
                  t.bids ? `${t.bids} bid${t.bids === 1 ? "" : "s"}` : null,
                  t.subs ? `${t.subs} sub${t.subs === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
          {canWrite && (
            <button className="btn btn-ghost" onClick={() => remove(t.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
    </>
  );
}

/* ══════════════ REMINDERS ══════════════ */
export function RemindersEditor({
  cadence,
  cap,
  canWrite,
}: {
  cadence: string;
  cap: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cadence);
  const [capValue, setCapValue] = useState(String(cap));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cadence: value, cap: Number(capValue) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage("Saved. New bids start with these.");
    router.refresh();
  }

  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: FAINT, marginBottom: 8 }}>
        Default cadence
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {REMINDER_CADENCES.filter((c) => c !== "Stopped").map((c) => (
          <label key={c} className="radio">
            <input
              type="radio"
              name="cadence"
              checked={value === c}
              disabled={!canWrite}
              onChange={() => setValue(c)}
            />
            <span className="dot" />
            {c}
          </label>
        ))}
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="cap">Maximum reminders per invitation</label>
        <input
          id="cap"
          className="input"
          inputMode="numeric"
          value={capValue}
          disabled={!canWrite}
          onChange={(e) => setCapValue(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <div style={{ fontSize: 12, marginTop: 12, color: MUTED }}>
        Reminders always stop on a price, a decline, or an award — whichever
        comes first.
      </div>

      {error && <div style={{ fontSize: 13, color: "#b3261e", marginTop: 8 }}>{error}</div>}
      {message && <div style={{ fontSize: 13, color: "var(--color-accent-800)", marginTop: 8 }}>{message}</div>}

      {canWrite && (
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save defaults"}
        </button>
      )}
    </>
  );
}

/* ══════════════ TEAM ══════════════ */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  /** 'admin' or 'pm' on the payment schedule. An owner is an admin anyway. */
  paymentsRole: string;
  lastActive: string;
  isYou: boolean;
};

export function TeamEditor({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setInviting(false);
    setForm({ name: "", email: "", role: "staff" });
    setCreated({ email: data.email, password: data.password });
    router.refresh();
  }

  return (
    <>
      {isOwner && (
        <button className="btn btn-primary blueprint" onClick={() => setInviting(true)}>
          Invite user
          <i className="corner tl" /><i className="corner tr" />
          <i className="corner bl" /><i className="corner br" />
        </button>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#b3261e", width: "100%", marginTop: 8 }}>{error}</div>
      )}

      {inviting && (
        <Modal
          title="Invite a teammate"
          subtitle="They get an account straight away — you pass on the password."
          onClose={() => setInviting(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setInviting(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={invite} disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
            </>
          }
        >
          <ModalField
            id="name"
            label="Name"
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Yesenia Cruz"
          />
          <ModalField
            id="email"
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="yesenia@sflbuildersgroup.com"
          />
          <ModalField
            id="role"
            label="Role"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            options={["staff", "viewer"]}
          />
          <div style={{ fontSize: 12, color: MUTED }}>
            <strong>Staff</strong> can create projects and bids, invite subs and
            award work. <strong>Viewer</strong> can see everything but change
            nothing. You can make someone an owner afterwards.
          </div>
        </Modal>
      )}

      {created && (
        <Modal
          title="Account created"
          subtitle="Give them these. They can change the password on My account."
          onClose={() => setCreated(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setCreated(null)}>
              Done
            </button>
          }
        >
          <div className="field">
            <label>Email</label>
            <div className="mono" style={{ fontSize: 15 }}>{created.email}</div>
          </div>
          <div className="field">
            <label>One-time password</label>
            <div className="mono" style={{ fontSize: 20, letterSpacing: ".04em" }}>
              {created.password}
            </div>
          </div>
          <p style={{ fontSize: 13, margin: 0 }}>
            <strong>Write this down now.</strong> It isn&apos;t stored anywhere you
            can read it back.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard?.writeText(created.password)}
          >
            Copy password
          </button>
        </Modal>
      )}
    </>
  );
}

export function TeamTable({ team, isOwner }: { team: TeamMember[]; isOwner: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  /** One route for both roles — it takes whichever one is sent. */
  async function patch(id: string, change: Record<string, string>) {
    setError(null);
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    router.refresh();
  }

  return (
    <>
      {error && <div style={{ fontSize: 13, color: "#b3261e", padding: "0 0 8px" }}>{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Payments</th>
            <th style={{ textAlign: "right" }}>Last active</th>
          </tr>
        </thead>
        <tbody>
          {team.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 500 }}>
                {u.name}
                {u.isYou && <span style={{ color: MUTED, fontWeight: 400 }}> (you)</span>}
              </td>
              <td style={{ fontSize: 13 }}>{u.email}</td>
              <td>
                {isOwner ? (
                  <select
                    className="input"
                    style={{ width: 130 }}
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                  >
                    <option value="owner">owner</option>
                    <option value="staff">staff</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <span className="tag tag-neutral">{u.role}</span>
                )}
              </td>
              {/*
                Who handles the money. An owner is a payments admin whatever
                the column says — someone must always be able to pay a week
                and undo a mistake — so their row states it rather than
                offering a choice that would not be honoured.
              */}
              <td>
                {u.role === "owner" ? (
                  <span
                    className="tag tag-accent"
                    title="An owner always handles the payments — the schedule can never be left without an admin."
                  >
                    Admin (owner)
                  </span>
                ) : isOwner ? (
                  <select
                    className="input"
                    style={{ width: 150 }}
                    value={u.paymentsRole === "admin" ? "admin" : "pm"}
                    onChange={(e) => patch(u.id, { paymentsRole: e.target.value })}
                    title="Admins pay rows, send them back and reopen weeks. Project managers own their own week."
                  >
                    <option value="pm">Project manager</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className="tag tag-neutral">
                    {u.paymentsRole === "admin" ? "Admin" : "Project manager"}
                  </span>
                )}
              </td>
              <td style={{ textAlign: "right", fontSize: 13 }}>{u.lastActive}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ══════════════ TEMPLATES ══════════════ */
export type CustomField = { key: string; value: string };

export function TemplatesEditor({
  kind,
  subject: initialSubject,
  body: initialBody,
  sms: initialSms,
  customFields: initialFields,
  canWrite,
}: {
  kind: string;
  subject: string;
  body: string;
  sms: string;
  customFields: CustomField[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sms, setSms] = useState(initialSms);
  const [fields, setFields] = useState<CustomField[]>(initialFields);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, subject, body, sms, customFields: fields }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  const segments = Math.max(1, Math.ceil(sms.length / 160));

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22 }}>
        <div className="blueprint" style={{ padding: 18 }}>
          <h4 style={{ margin: "0 0 10px" }}>Email</h4>
          <div className="field" style={{ marginBottom: 10 }}>
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              className="input"
              value={subject}
              disabled={!canWrite}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="body">Body</label>
            <textarea
              id="body"
              className="input"
              style={{ minHeight: 210 }}
              value={body}
              disabled={!canWrite}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <i className="corner tl" /><i className="corner tr" />
          <i className="corner bl" /><i className="corner br" />
        </div>

        <div className="blueprint" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0 }}>SMS</h4>
            <NotConnected />
          </div>
          <div className="field">
            <label htmlFor="sms">Message</label>
            <textarea
              id="sms"
              className="input"
              style={{ minHeight: 130 }}
              value={sms}
              disabled={!canWrite}
              onChange={(e) => setSms(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 11, marginTop: 8, color: FAINT }}>
            {sms.length} characters · {segments} segment{segments === 1 ? "" : "s"} ·
            saved and ready — nothing is sent by text until Twilio is switched on
          </div>

          {error && <div style={{ fontSize: 13, color: "#b3261e", marginTop: 8 }}>{error}</div>}
          {message && (
            <div style={{ fontSize: 13, color: "var(--color-accent-800)", marginTop: 8 }}>{message}</div>
          )}

          {canWrite && (
            <button className="btn btn-primary btn-block" style={{ marginTop: "auto" }} onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save templates"}
            </button>
          )}
          <i className="corner tl" /><i className="corner tr" />
          <i className="corner bl" /><i className="corner br" />
        </div>
      </div>

      <div className="blueprint" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0 }}>Custom fields</h4>
            <div style={{ fontSize: 12, color: MUTED }}>
              Your own variables. Drop the token into any template above.
            </div>
          </div>
          {canWrite && (
            <button
              className="btn btn-secondary"
              style={{ marginLeft: "auto" }}
              onClick={() => setFields((f) => [...f, { key: "new_field", value: "" }])}
            >
              <Plus size={15} /> Add field
            </button>
          )}
        </div>

        <div
          className="cfieldhead"
          style={{
            display: "grid",
            gridTemplateColumns: "170px minmax(0,1fr) 140px 40px",
            gap: 8,
            alignItems: "center",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: FAINT,
            padding: "14px 0 6px",
          }}
        >
          <div>Name</div><div>Value</div><div>Token</div><div />
        </div>

        {fields.length === 0 && (
          <div style={{ fontSize: 13, color: MUTED }}>
            None yet. Handy for things you repeat — a job-site contact, a
            standard note about parking.
          </div>
        )}

        {fields.map((c, n) => (
          <div
            key={n}
            className="cfieldrow"
            style={{
              display: "grid",
              gridTemplateColumns: "170px minmax(0,1fr) 140px 40px",
              gap: 8,
              alignItems: "center",
              padding: "4px 0",
            }}
          >
            <input
              className="input"
              value={c.key}
              disabled={!canWrite}
              onChange={(e) =>
                setFields((f) =>
                  f.map((x, i) =>
                    i === n ? { ...x, key: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase() } : x
                  )
                )
              }
            />
            <input
              className="input"
              value={c.value}
              disabled={!canWrite}
              onChange={(e) =>
                setFields((f) => f.map((x, i) => (i === n ? { ...x, value: e.target.value } : x)))
              }
            />
            <div className="mono" style={{ fontSize: 12, color: "var(--color-accent-700)" }}>
              {`{${c.key}}`}
            </div>
            {canWrite && (
              <button
                className="btn btn-ghost"
                aria-label="Remove field"
                onClick={() => setFields((f) => f.filter((_, i) => i !== n))}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}

        <i className="corner tl" /><i className="corner tr" />
        <i className="corner bl" /><i className="corner br" />
      </div>
    </>
  );
}
