import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Blueprint from "@/components/Blueprint";
import { RemindersEditor } from "../SettingsClients";

export const dynamic = "force-dynamic";
const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

export default async function RemindersPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("default_cadence, reminder_cap")
    .single();

  return (
    <>
      <header className="pagehead" style={{ padding: "18px 28px", borderBottom: "1px solid var(--color-divider)" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Reminder defaults</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          Applied to every new bid; overridable per bid
        </div>
      </header>
      <div className="pagebody" style={{ padding: "26px 28px 40px", maxWidth: 560 }}>
        <Blueprint style={{ padding: 18 }}>
          <RemindersEditor
            cadence={settings?.default_cadence ?? "Every 2 days"}
            cap={settings?.reminder_cap ?? 5}
            canWrite={canWrite(user)}
          />
        </Blueprint>
      </div>
    </>
  );
}
