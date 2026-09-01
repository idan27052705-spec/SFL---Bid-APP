import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { ROLE_LABEL, type AppRole } from "@/app/config";
import AccessForm from "./AccessForm";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function TeamMemberPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: person } = await supabase
    .from("profiles")
    .select("id, name, email, app_role, page_access, last_active_at, created_at")
    .eq("id", params.id)
    .single();

  if (!person) notFound();

  const appRole = ((person.app_role as AppRole) ?? "pm") as AppRole;
  const isAdmin = user.appRole === "admin";

  return (
    <>
      <header
        className="pagehead"
        style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link className="btn btn-ghost" href="/settings/team" style={{ paddingLeft: 0 }}>
          ← Team &amp; roles
        </Link>
        <div style={{ marginTop: 4 }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>{person.name}</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            {person.email} · {ROLE_LABEL[appRole]} ·{" "}
            {person.last_active_at
              ? `last active ${timeAgo(person.last_active_at)}`
              : "never signed in"}
          </div>
        </div>
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        {isAdmin ? (
          <AccessForm
            person={{
              id: person.id,
              name: person.name,
              email: person.email,
              appRole,
              pageAccess: (person.page_access as string[]) ?? [],
            }}
            isYou={person.id === user.id}
          />
        ) : (
          <div className="card" style={{ maxWidth: 560, fontSize: 14 }}>
            Only an admin can change what someone can access.
          </div>
        )}
      </div>
    </>
  );
}
