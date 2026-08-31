import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PaymentsProvider from "./PaymentsProvider";
import { paymentsRoleOf } from "@/lib/paymentsGuard";
import {
  PROOF_COLUMNS,
  REOPEN_COLUMNS,
  ROW_COLUMNS,
  asProofRecords,
  asReopenRecords,
  asRowRecords,
  toPaymentRow,
  toReopenRequest,
  type ProofRowRecord,
} from "@/lib/paymentsServer";
import type {
  PM,
  PaymentRow,
  Project,
  ReopenRequest,
  WeekSubmission,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Schedule Payments — where the whole section's data is read.
 *
 * Every screen under /payments reads the same four tables, and they read
 * across weeks: the week list totals a quarter of history, the approvals
 * queue is company-wide, and a week report needs to know who else has
 * signed. So it is read once here, in the layout that survives navigating
 * between them, and handed down as props. The provider below turns those
 * props into mutations that call /api/payments and ask for this read
 * again — nothing is kept in the browser, so a refresh loses nothing.
 *
 * Every query runs as the signed-in user, so RLS keeps this inside their
 * own company; nothing here filters by company_id a second time.
 */
export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = createClient();

  const [
    { data: profileRecords },
    { data: projectRecords },
    { data: rowRecords },
    { data: proofRecords },
    { data: submissionRecords },
    { data: reopenRecords },
  ] = await Promise.all([
    supabase.from("profiles").select("id, name, role, payments_role").order("name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("payment_rows")
      .select(ROW_COLUMNS)
      .order("week_start", { ascending: false }),
    supabase
      .from("payment_proofs")
      .select(`${PROOF_COLUMNS}, payment_row_id`)
      .order("created_at"),
    supabase
      .from("payment_week_submissions")
      .select("pm_id, week_start, submitted_at"),
    supabase
      .from("payment_reopen_requests")
      .select(REOPEN_COLUMNS)
      .order("created_at"),
  ]);

  const profiles = profileRecords ?? [];
  const me: PM = { id: user.id, name: user.name };

  /**
   * Everyone in the company, with you at the top.
   *
   * The chips on a week report and the PM filter both read this list, and
   * the row you are looking for first is your own — so it does not depend
   * on where your name happens to fall alphabetically.
   */
  const pms: PM[] = [
    me,
    ...profiles
      .filter((p) => p.id !== user.id)
      .map((p) => ({ id: p.id as string, name: p.name as string })),
  ];

  const projects: Project[] = (projectRecords ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
  }));

  /** The PM, whoever paid a row, whoever sent one back — all of them. */
  const names = new Map<string, string>(
    profiles.map((p) => [p.id as string, p.name as string])
  );

  /** Proofs, filed under the row they belong to before the rows are built. */
  const proofsByRow = new Map<string, ProofRowRecord[]>();
  asProofRecords(proofRecords).forEach((proof) => {
    const list = proofsByRow.get(proof.payment_row_id) ?? [];
    list.push(proof);
    proofsByRow.set(proof.payment_row_id, list);
  });

  const rows: PaymentRow[] = asRowRecords(rowRecords).map((record) =>
    toPaymentRow(record, names, proofsByRow.get(record.id) ?? [])
  );

  /**
   * A submission row IS the signature, so there is nothing here for a week
   * nobody has handed in — absence is what "not submitted" looks like.
   */
  const submissions: WeekSubmission[] = (submissionRecords ?? []).map((s) => ({
    pmId: s.pm_id as string,
    weekStart: s.week_start as string,
    submittedAt: s.submitted_at as string,
  }));

  const reopenRequests: ReopenRequest[] = asReopenRecords(reopenRecords).map(
    (record) => toReopenRequest(record, names)
  );

  const mine = profiles.find((p) => p.id === user.id);

  return (
    <PaymentsProvider
      me={me}
      pms={pms}
      projects={projects}
      paymentsRole={paymentsRoleOf(user.role, mine?.payments_role)}
      canWrite={canWrite(user)}
      rows={rows}
      submissions={submissions}
      reopenRequests={reopenRequests}
    >
      {children}
    </PaymentsProvider>
  );
}
