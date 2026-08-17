import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Blueprint from "@/components/Blueprint";
import NotAutomatic from "@/components/NotAutomatic";
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Reminder defaults</h1>
          <NotAutomatic />
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>
          Applied to every new bid; overridable per bid
        </div>
      </header>
      <div className="pagebody" style={{ padding: "26px 28px 40px", maxWidth: 560 }}>
        <Blueprint style={{ padding: 18, marginBottom: 18 }}>
          <h4 style={{ margin: "0 0 6px" }}>How reminders go out today</h4>
          <p style={{ fontSize: 13, margin: 0 }}>
            Nothing sends reminders on a schedule yet. These settings are saved
            and every bid carries its cadence, but a sub only hears from you
            again when you send it yourself — from{" "}
            <b>Who to chase</b> on the dashboard, or <b>Send again</b> on a
            bid&apos;s sub list. This note disappears when the scheduled job is
            switched on.
          </p>
        </Blueprint>

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
