import { Suspense } from "react";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Blueprint from "@/components/Blueprint";
import Tabs from "@/components/Tabs";
import { TemplatesEditor, type CustomField } from "../SettingsClients";

export const dynamic = "force-dynamic";
const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const FAINT = "color-mix(in srgb, var(--color-text) 45%, transparent)";
const HAIR = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

const TABS = [
  ["invite", "New bid invitation"],
  ["reminder", "Reminder"],
  ["award", "Award"],
] as const;

const WHEN: Record<string, string> = {
  invite: "Sent the moment you invite a sub to a bid package.",
  reminder: "Sent when you nudge a sub who hasn't priced yet, one at a time or in bulk.",
  award: "Sent to the winner when you award a package. Nothing is sent to the others.",
};

const BUILT_IN: [string, string, string][] = [
  ["{contact}", "The sub's contact name", "Carlos Betancourt"],
  ["{sub_company}", "The sub's company", "Sunrise Plumbing Inc."],
  ["{company_name}", "Your company", "SFL Builders Group"],
  ["{company_phone}", "Your office phone", "(954) 555-0100"],
  ["{project}", "Project name", "Las Olas Residences — Tower B"],
  ["{city}", "Project city", "Fort Lauderdale"],
  ["{trade}", "The trade on this package", "Plumbing"],
  ["{bid_title}", "Package title", "Floors 4–18 rough-in"],
  ["{due_date}", "When pricing is due", "Aug 21, 2026"],
  ["{portal_url}", "Their one-tap link", "bids.sflbuildersgroup.com/portal/…"],
  ["{access_code}", "Their 6-digit code", "244670"],
  ["{price}", "Awarded price (award only)", "$184,500"],
];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await requireUser();
  const supabase = createClient();
  const tab = searchParams.tab ?? "invite";

  const [{ data: templates }, { data: settings }] = await Promise.all([
    supabase.from("email_templates").select("kind, subject, body, sms"),
    supabase.from("settings").select("custom_fields").single(),
  ]);

  const current = (templates ?? []).find((t) => t.kind === tab);
  const customFields = (settings?.custom_fields ?? []) as CustomField[];

  return (
    <>
      <header className="pagehead" style={{ padding: "18px 28px 0", borderBottom: "1px solid var(--color-divider)" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Message templates</h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          One set per message type. Variables fill in automatically at send time.
        </div>
        <Suspense>
          <Tabs tabs={TABS} current={tab} />
        </Suspense>
      </header>

      <div
        className="pagebody"
        style={{ padding: "26px 28px 40px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1040 }}
      >
        <div style={{ fontSize: 13, color: MUTED }}>{WHEN[tab]}</div>

        <TemplatesEditor
          key={tab}
          kind={tab}
          subject={current?.subject ?? ""}
          body={current?.body ?? ""}
          sms={current?.sms ?? ""}
          customFields={customFields}
          canWrite={canWrite(user)}
        />

        <Blueprint style={{ padding: 18 }}>
          <h4 style={{ margin: "0 0 4px" }}>Built-in fields</h4>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            Always available. Filled from the bid and the sub at send time.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {BUILT_IN.map(([token, desc, sample]) => (
              <div key={token} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderTop: HAIR }}>
                <div className="mono" style={{ fontSize: 12, color: "var(--color-accent-700)", width: 96, flex: "none" }}>
                  {token}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{desc}</div>
                  <div style={{ fontSize: 11, color: FAINT }}>{sample}</div>
                </div>
              </div>
            ))}
          </div>
        </Blueprint>
      </div>
    </>
  );
}
