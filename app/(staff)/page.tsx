import { APP, COMPANY } from "@/app/config";

const STEPS = [
  { done: true, label: "Session 1 — repo, design system, domain, deploy" },
  { done: false, label: "Session 2 — Supabase database + RLS" },
  { done: false, label: "Session 3 — staff login and roles" },
  { done: false, label: "Session 4 — projects, files, subs" },
  { done: false, label: "Session 5 — bids and the bid builder" },
  { done: false, label: "Session 6 — invitations + email sending" },
  { done: false, label: "Session 7 — sub portal (EN / ES)" },
  { done: false, label: "Session 8 — dashboard, compare, award" },
  { done: false, label: "Session 9 — security hardening" },
];

export default function DashboardPage() {
  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">{COMPANY.name}</h6>
        <h1>Dashboard</h1>
        <p className="text-muted" style={{ maxWidth: 620 }}>
          {APP.name} is live at {APP.domain}. The design system, brand and app
          shell are in place — the data layer comes next.
        </p>
      </div>

      <div className="pagebody">
        <div className="card" style={{ maxWidth: 620 }}>
          <div className="card-kicker">Build progress</div>
          <div className="card-title">Where we are</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {STEPS.map((s) => (
              <li
                key={s.label}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "6px 0",
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                  opacity: s.done ? 1 : 0.55,
                }}
              >
                <span className="mono">{s.done ? "[x]" : "[ ]"}</span>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
