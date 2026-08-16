import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import PortalShell from "../PortalShell";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
const FAINT = "color-mix(in srgb, var(--color-text) 50%, transparent)";

export default async function PortalProfilePage() {
  const sub = await getPortalSub();
  if (!sub) redirect("/portal");

  const lang = pickLang(cookies().get("sfl_lang")?.value);
  const t = STR[lang];
  const admin = createAdminClient();

  const { data: requests } = await admin
    .from("change_requests")
    .select("id, field, value, status, created_at")
    .eq("sub_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const facts: [string, string][] = [
    ["Company name", sub.company_name],
    ["Contact name", sub.contact_name ?? "—"],
    ["Email", sub.email ?? "—"],
    ["Phone", sub.phone ?? "—"],
    ["City", sub.city ?? "—"],
  ];

  return (
    <PortalShell lang={lang} subName={sub.company_name}>
      <div
        style={{
          width: "min(100%, 720px)",
          margin: "0 auto",
          padding: "32px 24px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <h1 style={{ fontSize: 36, margin: 0 }}>{t.myInfo}</h1>

        <div className="blueprint" style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px 26px" }}>
            {facts.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: FAINT }}>
                  {k}
                </div>
                <div style={{ fontSize: 15, wordBreak: "break-word" }}>{v}</div>
              </div>
            ))}
          </div>
          <i className="corner tl" /><i className="corner tr" />
          <i className="corner bl" /><i className="corner br" />
        </div>

        <ProfileForm lang={lang} requests={requests ?? []} />
      </div>
    </PortalShell>
  );
}
