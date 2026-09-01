"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Blueprint from "@/components/Blueprint";
import {
  APP_ROLES,
  PAGES,
  ROLE_LABEL,
  ROLE_NOTE,
  type AppRole,
} from "@/app/config";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: FAINT,
};

/**
 * One person's access.
 *
 * Access is per page, not per button — a project manager either has
 * Schedule Payments or doesn't. Inside that page the finer rules already
 * exist (an admin pays and sends back; a PM fills in their own week), and
 * that is the only page where they do, because it's the only one the
 * whole team works in today.
 */
export default function AccessForm({
  person,
  isYou,
}: {
  person: {
    id: string;
    name: string;
    email: string;
    appRole: AppRole;
    pageAccess: string[];
  };
  isYou: boolean;
}) {
  const router = useRouter();
  const [appRole, setAppRole] = useState<AppRole>(person.appRole);
  const [pages, setPages] = useState<string[]>(person.pageAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isAdmin = appRole === "admin";

  const toggle = (key: string) => {
    setSaved(false);
    setPages((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  };

  const groups = ["Work", "Settings"] as const;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/team/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appRole, pageAccess: pages }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Couldn't save that.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
      <Blueprint style={{ padding: 20 }}>
        <h4 style={{ margin: "0 0 4px" }}>Role</h4>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          {ROLE_NOTE[appRole]}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {APP_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className="btn"
              onClick={() => {
                setAppRole(r);
                setSaved(false);
              }}
              style={{
                padding: "8px 14px",
                background:
                  appRole === r
                    ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                    : "transparent",
                borderColor:
                  appRole === r ? "var(--color-accent)" : "var(--color-divider)",
              }}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {isYou && isAdmin && (
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 0 }}>
            This is your own account. You can&apos;t take away your own admin —
            another admin has to do that.
          </p>
        )}
      </Blueprint>

      <Blueprint style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h4 style={{ margin: "0 0 4px" }}>Pages</h4>
          {isAdmin && (
            <span className="tag tag-accent">Admins see every page</span>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          {isAdmin
            ? "Nothing to choose while they're an admin. Switch them to Project manager to pick pages — what's ticked here is kept and used the moment you do."
            : "They see only what's ticked. Everything else disappears from their menu, and typing the address gets them nowhere."}
        </p>

        {groups.map((group) => (
          <div key={group} style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 8 }}>{group}</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "10px 26px",
              }}
            >
              {PAGES.filter((p) => p.group === group).map((p) => {
                const on = isAdmin || p.always || pages.includes(p.key);
                const locked = isAdmin || p.always;
                return (
                  <label
                    key={p.key}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 14,
                      cursor: locked ? "default" : "pointer",
                      opacity: locked && !isAdmin ? 0.75 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      className="chk"
                      checked={on}
                      disabled={locked}
                      onChange={() => toggle(p.key)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      {p.label}
                      {p.note && (
                        <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                          {p.note}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </Blueprint>

      {error && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save access"}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "var(--color-accent-700)" }}>
            Saved. It takes effect the next time they load a page.
          </span>
        )}
      </div>
    </div>
  );
}
