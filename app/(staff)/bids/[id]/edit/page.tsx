import { notFound, redirect } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BidBuilder, { type BuilderItem } from "@/components/BidBuilder";

export const dynamic = "force-dynamic";

export default async function EditBidPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!canWrite(user)) redirect(`/bids/${params.id}`);

  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "id, short_id, title, due_date, scope, cadence, status, trade_id, projects(id, short_id, name)"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) notFound();

  // Awarded packages are history — the API refuses edits too.
  if (bid.status === "Awarded") redirect(`/bids/${bid.short_id}`);

  const project = bid.projects as unknown as {
    id: string;
    short_id: number;
    name: string;
  };

  const [{ data: trades }, { data: files }, { data: lineItems }, { data: attached }] =
    await Promise.all([
      supabase.from("trades").select("id, name").order("position"),
      supabase
        .from("files")
        .select("id, name, size_bytes, kind")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bid_line_items")
        .select("description, detail, qty, unit")
        .eq("bid_id", bid.id)
        .order("position"),
      supabase.from("bid_files").select("file_id").eq("bid_id", bid.id),
    ]);

  const items: BuilderItem[] = (lineItems ?? []).map((i, n) => ({
    key: `i${n}`,
    description: i.description ?? "",
    detail: i.detail ?? "",
    qty: i.qty == null ? "" : String(i.qty),
    unit: i.unit ?? "lot",
  }));

  return (
    <BidBuilder
      mode="edit"
      bidShortId={bid.short_id}
      projectShortId={project.short_id}
      projectName={project.name}
      trades={trades ?? []}
      projectFiles={files ?? []}
      initial={{
        tradeId: bid.trade_id ?? "",
        title: bid.title ?? "",
        dueDate: bid.due_date ?? "",
        scope: bid.scope ?? "",
        cadence: bid.cadence ?? "Every 2 days",
        items,
        fileIds: (attached ?? []).map((a) => a.file_id),
      }}
    />
  );
}
