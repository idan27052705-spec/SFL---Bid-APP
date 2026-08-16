import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CompareClient, { type Quote } from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select("id, short_id, due_date, awarded_sub_id, projects(short_id, name), trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();

  const { data: invitations } = await supabase
    .from("invitations")
    .select(
      "id, status, sent_at, viewed_at, decline_reason, sub_id, subs(company_name, contact_name), responses(price, lead_time, exclusions, notes, submitted_at, file_id, files(name))"
    )
    .eq("bid_id", bid.id);

  const quotes: Quote[] = (invitations ?? []).map((iv) => {
    const sub = iv.subs as unknown as {
      company_name: string;
      contact_name: string | null;
    } | null;

    const raw = iv.responses as unknown as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | null;
    const r = (Array.isArray(raw) ? raw[0] : raw) as
      | {
          price: number | null;
          lead_time: string | null;
          exclusions: string | null;
          notes: string | null;
          submitted_at: string | null;
          file_id: string | null;
          files: { name: string } | null;
        }
      | undefined;

    return {
      invitationId: iv.id,
      subId: iv.sub_id,
      company: sub?.company_name ?? "—",
      contact: sub?.contact_name ?? null,
      status: iv.status,
      price: r?.price ?? null,
      leadTime: r?.lead_time ?? null,
      exclusions: r?.exclusions ?? null,
      notes: r?.notes ?? null,
      submittedAt: r?.submitted_at ?? null,
      fileId: r?.file_id ?? null,
      fileName: r?.files?.name ?? null,
      declineReason: iv.decline_reason,
      viewedAt: iv.viewed_at,
      sentAt: iv.sent_at,
    };
  });

  const project = bid.projects as unknown as { short_id: number; name: string } | null;
  const trade = bid.trades as unknown as { name: string } | null;

  return (
    <CompareClient
      bidShortId={bid.short_id}
      tradeName={trade?.name ?? ""}
      projectName={project?.name ?? ""}
      projectShortId={project?.short_id ?? 0}
      dueDate={bid.due_date}
      awardedSubId={bid.awarded_sub_id}
      quotes={quotes}
      canWrite={canWrite(user)}
    />
  );
}
