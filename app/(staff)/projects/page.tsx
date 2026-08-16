import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProjectsClient, { type ProjectRow } from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, short_id, name, client, city, county, type, status, start_date")
    .order("created_at", { ascending: false });

  const { data: bids } = await supabase.from("bids").select("project_id");

  const counts = new Map<string, number>();
  (bids ?? []).forEach((b) =>
    counts.set(b.project_id, (counts.get(b.project_id) ?? 0) + 1)
  );

  const rows: ProjectRow[] = (projects ?? []).map((p) => ({
    ...p,
    bidCount: counts.get(p.id) ?? 0,
  }));

  return <ProjectsClient projects={rows} canWrite={canWrite(user)} />;
}
