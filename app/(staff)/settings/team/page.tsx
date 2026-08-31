import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";
import { TeamEditor, TeamTable, type TeamMember } from "../SettingsClients";

export const dynamic = "force-dynamic";
const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function TeamPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, role, payments_role, last_active_at, created_at")
    .order("created_at");

  const team: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    // What they are on the payment schedule. An owner is an admin there
    // regardless of the column, so the table shows that rather than
    // whatever happens to be stored against them.
    paymentsRole: p.payments_role,
    lastActive: p.last_active_at ? timeAgo(p.last_active_at) : "—",
    isYou: p.id === user.id,
  }));

  const isOwner = user.role === "owner";

  return (
    <>
      <header
        className="pagehead"
        style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Team &amp; roles</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            Owner, staff and read-only access · who handles the payments
          </div>
        </div>
        <TeamEditor isOwner={isOwner} />
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px", maxWidth: 960 }}>
        <Blueprint style={{ padding: "12px 18px 6px" }}>
          <TeamTable team={team} isOwner={isOwner} />
        </Blueprint>
      </div>
    </>
  );
}
