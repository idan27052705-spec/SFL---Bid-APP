import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import Blueprint from "@/components/Blueprint";

export const dynamic = "force-dynamic";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

export default async function ActivityPage() {
  await requireUser();
  const supabase = createClient();

  const { data: activity } = await supabase
    .from("activity")
    .select("id, type, text, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <header
        className="pagehead"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div>
          <h1 style={{ fontSize: 30, margin: 0 }}>Activity</h1>
          <div style={{ fontSize: 13, color: MUTED }}>
            Everything that has happened, newest first
          </div>
        </div>
      </header>

      <div className="pagebody" style={{ padding: "26px 28px 40px" }}>
        <Blueprint style={{ padding: "16px 18px 18px", maxWidth: 820 }}>
          {(activity ?? []).length === 0 ? (
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Nothing yet.</p>
          ) : (
            (activity ?? []).map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: HAIR }}>
                <span className="tag tag-neutral" style={{ flex: "none", width: 88, justifyContent: "center" }}>
                  {a.type}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: FAINT }}>
                    {timeAgo(a.created_at)}{a.meta ? ` · ${a.meta}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </Blueprint>
      </div>
    </>
  );
}
