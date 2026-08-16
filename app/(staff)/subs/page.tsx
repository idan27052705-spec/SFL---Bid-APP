import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revealCode } from "@/lib/accessCode";
import SubsClient, { type SubRow } from "./SubsClient";

export const dynamic = "force-dynamic";

export default async function SubsPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: subs }, { data: trades }, { data: invitations }] = await Promise.all([
    supabase
      .from("subs")
      .select(
        "id, short_id, company_name, contact_name, email, phone, city, status, access_code_enc, sub_trades(trades(name))"
      )
      .order("company_name"),
    supabase.from("trades").select("id, name").order("position"),
    supabase.from("invitations").select("sub_id, responses(id)"),
  ]);

  const stats = new Map<string, { invited: number; responded: number }>();
  (invitations ?? []).forEach((iv) => {
    const rec = stats.get(iv.sub_id) ?? { invited: 0, responded: 0 };
    rec.invited += 1;
    const r = iv.responses as unknown as unknown[] | unknown | null;
    if (Array.isArray(r) ? r.length > 0 : !!r) rec.responded += 1;
    stats.set(iv.sub_id, rec);
  });

  const rows: SubRow[] = (subs ?? []).map((s) => {
    const links = (s.sub_trades ?? []) as unknown as { trades: { name: string } | null }[];
    const stat = stats.get(s.id) ?? { invited: 0, responded: 0 };
    return {
      id: s.id,
      short_id: s.short_id,
      company: s.company_name,
      contact: s.contact_name ?? "",
      phone: s.phone ?? "",
      city: s.city ?? "",
      trades: links.map((l) => l.trades?.name).filter(Boolean) as string[],
      invited: stat.invited,
      responded: stat.responded,
      code: revealCode(s.access_code_enc),
      status: s.status,
    };
  });

  return <SubsClient subs={rows} trades={trades ?? []} canWrite={canWrite(user)} />;
}
