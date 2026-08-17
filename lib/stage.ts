import { CLOSED_STAGES, stageOrder } from "@/app/config";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nudge a project forward a stage as work happens — a bid created, an
 * invitation sent, a price arriving.
 *
 * Only ever forward, and never out of Closed or Archived. Those two are
 * always a person's decision: if someone closes a job, a late price
 * shouldn't quietly reopen it.
 */
export async function advanceProjectStage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  projectId: string,
  target: "Building bids" | "Sent bids" | "Review"
) {
  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .single();

  if (!project) return;
  if (CLOSED_STAGES.includes(project.status)) return;
  if (stageOrder(project.status) >= stageOrder(target)) return;

  await supabase.from("projects").update({ status: target }).eq("id", project.id);
}
