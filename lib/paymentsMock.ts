import type { PM, PaymentRow, Project, WeekSubmission } from "@/lib/payments";

/**
 * Stand-in data while the UI is being designed.
 *
 * Nothing here touches Supabase. This is the only file that gets deleted
 * when the real tables land — the shapes it fills live in lib/payments.ts,
 * so the screens themselves won't change.
 *
 * There are deliberately no seeded payments: every week starts empty, the
 * way a real one does, so the screens show what a PM actually walks into
 * on a Thursday morning.
 */

/**
 * Who handles the money.
 *
 * Roles are not built yet, so for now the signed-in user is the finance
 * manager and can see the approvals screen. When roles arrive this becomes
 * a check for a `finance` role on the profile — one line, right here.
 */
export const SIGNED_IN_USER_IS_FINANCE = true;

/** The other project managers. The signed-in user is added at runtime. */
export const MOCK_PMS: PM[] = [
  { id: "pm-maria", name: "Maria Alvarez" },
  { id: "pm-carlos", name: "Carlos Ruiz" },
  { id: "pm-dan", name: "Dan Levi" },
  { id: "pm-sofia", name: "Sofia Marin" },
  { id: "pm-alex", name: "Alex Brenner" },
];

/**
 * Known projects. Only used to attach a real project id when the name a
 * PM types happens to match one — the field itself is free text.
 */
export const MOCK_PROJECTS: Project[] = [
  { id: "prj-lasolas", name: "Las Olas Residence" },
  { id: "prj-sunrise", name: "Sunrise Tower 12" },
  { id: "prj-coral", name: "Coral Ridge Duplex" },
  { id: "prj-weston", name: "Weston Office Fit-Out" },
  { id: "prj-hollywood", name: "Hollywood Beach Villa" },
];

/** Every PM, with the signed-in user first. */
export const allPms = (me: PM): PM[] => [me, ...MOCK_PMS];

/** No payments anywhere — every week starts blank. */
export function seedPayments(): PaymentRow[] {
  return [];
}

/** Nobody has handed a week in yet. */
export function seedSubmissions(): WeekSubmission[] {
  return [];
}
