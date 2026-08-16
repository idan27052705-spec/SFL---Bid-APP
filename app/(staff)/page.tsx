import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP } from "@/app/config";

const STEPS = [
  { done: true, label: "Session 1 — repo, design system, domain, deploy" },
  { done: true, label: "Session 2 — Supabase database + security rules" },
  { done: true, label: "Session 3 — staff login and roles" },
  { done: false, label: "Session 4 — projects, files, subs" },
  { done: false, label: "Session 5 — bids and the bid builder" },
  { done: false, label: "Session 6 — invitations + email sending" },
  { done: false, label: "Session 7 — sub portal (EN / ES)" },
  { done: false, label: "Session 8 — dashboard, compare, award" },
  { done: false, label: "Session 9 — security hardening" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ count: projects }, { count: bids }, { count: subs }, { count: trades }] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("bids").select("id", { count: "exact", head: true }),
      supabase.from("subs").select("id", { count: "exact", head: true }),
      supabase.from("trades").select("id", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Projects", value: projects ?? 0 },
    { label: "Bids", value: bids ?? 0 },
    { label: "Subs", value: subs ?? 0 },
    { label: "Trades", value: trades ?? 0 },
  ];

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">{user.companyName}</h6>
        <h1>Dashboard</h1>
        <p className="text-muted" style={{ maxWidth: 640 }}>
          Signed in as {user.name}. {APP.name} is connected to the database —
          these counts are live. Projects, bids and subs come next.
        </p>
      </div>

      <div className="pagebody" style={{ display: "grid", gap: 18, maxWidth: 720 }}>
        <div
          className="cols"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
        >
          {stats.map((s) => (
            <div key={s.label} className="card">
              <div className="card-kicker">{s.label}</div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 34,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
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
