import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubsClient, { type SubRow } from "./SubsClient";

export const dynamic = "force-dynamic";

export default async function SubsPage() {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: subs }, { data: trades }] = await Promise.all([
    supabase
      .from("subs")
      .select(
        "id, short_id, company_name, contact_name, email, phone, city, status, sub_trades(trades(name))"
      )
      .order("company_name"),
    supabase.from("trades").select("id, name").order("position"),
  ]);

  const rows: SubRow[] = (subs ?? []).map((s) => {
    const links = (s.sub_trades ?? []) as unknown as {
      trades: { name: string } | null;
    }[];
    return {
      id: s.id,
      short_id: s.short_id,
      company_name: s.company_name,
      contact_name: s.contact_name,
      email: s.email,
      phone: s.phone,
      city: s.city,
      status: s.status,
      trades: links.map((l) => l.trades?.name).filter(Boolean) as string[],
    };
  });

  return (
    <SubsClient
      subs={rows}
      trades={trades ?? []}
      canWrite={canWrite(user)}
    />
  );
}
