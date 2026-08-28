import { requireUser, canWrite } from "@/lib/auth";
import PaymentsProvider from "./PaymentsProvider";
import {
  MOCK_PROJECTS,
  SIGNED_IN_USER_IS_FINANCE,
  allPms,
  seedPayments,
  seedSubmissions,
} from "@/lib/paymentsMock";
import type { PM } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Schedule Payments.
 *
 * UI stage: the rows come from lib/paymentsMock, not from Supabase, so the
 * screens can be used and argued with before any tables exist. The signed-in
 * user is real — they appear as one of the PMs, so submitting a week and
 * editing your own rows behave the way they will once this is wired up.
 *
 * When the real tables land, only the seed calls and the finance flag below
 * change.
 */
export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const me: PM = { id: user.id, name: user.name };

  return (
    <PaymentsProvider
      me={me}
      pms={allPms(me)}
      projects={MOCK_PROJECTS}
      isOwner={user.role === "owner"}
      canWrite={canWrite(user)}
      isFinance={SIGNED_IN_USER_IS_FINANCE}
      initialRows={seedPayments()}
      initialSubmissions={seedSubmissions()}
    >
      {children}
    </PaymentsProvider>
  );
}
