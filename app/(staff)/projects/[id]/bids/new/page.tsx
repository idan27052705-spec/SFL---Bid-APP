import { notFound, redirect } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BidBuilder from "@/components/BidBuilder";

export const dynamic = "force-dynamic";

export default async function NewBidPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!canWrite(user)) redirect(`/projects/${params.id}`);

  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, short_id, name")
    .eq("short_id", Number(params.id))
    .single();

  if (!project) notFound();

  const [{ data: trades }, { data: files }] = await Promise.all([
    supabase.from("trades").select("id, name").order("position"),
    supabase
      .from("files")
      .select("id, name, size_bytes, kind")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <BidBuilder
      mode="new"
      projectShortId={project.short_id}
      projectName={project.name}
      trades={trades ?? []}
      projectFiles={files ?? []}
    />
  );
}
