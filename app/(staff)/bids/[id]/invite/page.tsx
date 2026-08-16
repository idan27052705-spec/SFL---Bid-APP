import { notFound, redirect } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import InviteClient, { type InviteSub } from "./InviteClient";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!canWrite(user)) redirect(`/bids/${params.id}`);

  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select("id, short_id, status, projects(name), trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();
  if (bid.status === "Awarded") redirect(`/bids/${bid.short_id}`);

  const project = bid.projects as unknown as { name: string } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  const [{ data: subs }, { data: invited }] = await Promise.all([
    supabase
      .from("subs")
      .select("id, company_name, contact_name, email, city, status, sub_trades(trades(name))")
      .eq("status", "Active")
      .order("company_name"),
    supabase.from("invitations").select("sub_id").eq("bid_id", bid.id),
  ]);

  const invitedIds = new Set((invited ?? []).map((i) => i.sub_id));

  const rows: InviteSub[] = (subs ?? []).map((s) => {
    const links = (s.sub_trades ?? []) as unknown as {
      trades: { name: string } | null;
    }[];
    return {
      id: s.id,
      company_name: s.company_name,
      contact_name: s.contact_name,
      email: s.email,
      city: s.city,
      trades: links.map((l) => l.trades?.name).filter(Boolean) as string[],
      alreadyInvited: invitedIds.has(s.id),
    };
  });

  return (
    <InviteClient
      bidShortId={bid.short_id}
      tradeName={trade?.name ?? ""}
      projectName={project?.name ?? ""}
      subs={rows}
    />
  );
}
