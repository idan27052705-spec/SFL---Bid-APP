"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import type {
  PM,
  PaymentMethod,
  PaymentRow,
  Project,
  ReopenRequest,
  WeekSubmission,
} from "@/lib/payments";
import type { PaymentsRole } from "@/lib/paymentsGuard";

/**
 * A proof whose bytes are already in storage.
 *
 * The file never goes through our server — the browser uploads it with a
 * signed URL and this is all that is left to record. See MarkPaidModal.
 */
export type StoredProof = {
  name: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
};

export type PaidDetails = {
  paidAt: string;
  reference: string;
  method: PaymentMethod | null;
  proofs: StoredProof[];
};

/**
 * One expected payment as a dialog hands it over. No id means a new one.
 *
 * Deliberately not a `PaymentRow`: a form knows what was typed, not what
 * the row will become. Who paid it, who sent it back and what its state is
 * are the server's answers, and they come back on the next read.
 */
export type PaymentDraft = {
  id?: string;
  weekStart: string;
  date: string | null;
  pmId: string;
  projectId: string | null;
  projectName: string;
  payTo: string;
  reason: string;
  amount: number;
};

/** Whatever a refused mutation threw, as a sentence to put on screen. */
export const errorMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : "That didn't save. Try again.";

type PaymentsContextValue = {
  me: PM;
  pms: PM[];
  projects: Project[];
  /** Who you are to the schedule: an admin handles the money. */
  paymentsRole: PaymentsRole;
  canWrite: boolean;
  rows: PaymentRow[];
  submissions: WeekSubmission[];
  reopenRequests: ReopenRequest[];
  saveRow: (draft: PaymentDraft) => Promise<void>;
  removeRow: (id: string) => Promise<void>;
  submitWeek: (week: string) => Promise<void>;
  markPaid: (id: string, details: PaidDetails) => Promise<void>;
  rejectRow: (id: string, reason: string) => Promise<void>;
  requestReopen: (week: string, message: string) => Promise<void>;
  resolveReopenRequest: (id: string, approved: boolean) => Promise<void>;
  /** An admin unlocking a week without being asked. */
  reopenWeek: (pmId: string, week: string) => Promise<void>;
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

export function usePayments(): PaymentsContextValue {
  const value = useContext(PaymentsContext);
  if (!value) throw new Error("usePayments must be used inside PaymentsProvider");
  return value;
}

/**
 * One call to /api/payments, with the server's own words on failure.
 *
 * Every route in the section answers `{ error }` with a sentence a person
 * can act on — "You've already handed this week in" — so throwing it is
 * what lets the dialog that asked show it. Nothing is swallowed: a
 * mutation either returns or throws.
 */
async function send(url: string, method: string, body?: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!res.ok || data?.ok === false)
    throw new Error(data?.error || "That didn't save. Try again.");

  return data;
}

/**
 * The payment data for every screen under /payments, and the only way to
 * change it.
 *
 * The rows, signatures and requests are the layout's server read, passed
 * straight through — not copied into state. A copy would be a second
 * answer to the same question: after a mutation asks for the read again,
 * the props arrive updated and a `useState` seeded from them would not,
 * so the screen would keep showing what was true before the save.
 *
 * Every mutation posts to the API, waits for the answer, then asks the
 * server for the data again. They return promises and throw on failure so
 * the dialog that called one can stay open, say what went wrong, and let
 * the person try again.
 */
export default function PaymentsProvider({
  me,
  pms,
  projects,
  paymentsRole,
  canWrite,
  rows,
  submissions,
  reopenRequests,
  children,
}: {
  me: PM;
  pms: PM[];
  projects: Project[];
  paymentsRole: PaymentsRole;
  canWrite: boolean;
  rows: PaymentRow[];
  submissions: WeekSubmission[];
  reopenRequests: ReopenRequest[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  /**
   * Editing a row that was sent back clears the rejection, which puts it
   * straight back in the finance queue. That is the whole loop, and it
   * happens in the route — there is no separate "resubmit" button here to
   * forget to press.
   */
  async function saveRow(draft: PaymentDraft) {
    const { id, ...fields } = draft;
    if (id) await send(`/api/payments/${id}`, "PATCH", fields);
    else await send("/api/payments", "POST", fields);
    router.refresh();
  }

  async function removeRow(id: string) {
    await send(`/api/payments/${id}`, "DELETE");
    router.refresh();
  }

  /** You sign your own week and nobody else's, so the route takes no PM. */
  async function submitWeek(week: string) {
    await send("/api/payments/submit", "POST", { weekStart: week });
    router.refresh();
  }

  async function markPaid(
    id: string,
    { paidAt, reference, method, proofs }: PaidDetails
  ) {
    await send(`/api/payments/${id}/paid`, "POST", {
      paidOn: paidAt,
      method,
      reference,
      proofs,
    });
    router.refresh();
  }

  async function rejectRow(id: string, reason: string) {
    await send(`/api/payments/${id}/reject`, "POST", { reason });
    router.refresh();
  }

  /**
   * A PM cannot un-submit themselves, so this is the only way a locked
   * week opens from their side: they ask, with a reason, and it lands in
   * the approvals queue. Asking a second time replaces the first rather
   * than stacking up — whoever reads that queue should see one line per
   * week, not a history of nagging.
   */
  async function requestReopen(week: string, message: string) {
    await send("/api/payments/reopen-requests", "POST", {
      weekStart: week,
      message,
    });
    router.refresh();
  }

  /**
   * Approving is the one thing that clears a submission — the week drops
   * back to draft for that PM, who edits it and signs it again. Declining
   * leaves the signature standing and keeps the ask on the record, with a
   * name against the decision.
   */
  async function resolveReopenRequest(id: string, approved: boolean) {
    await send(`/api/payments/reopen-requests/${id}`, "PATCH", { approved });
    router.refresh();
  }

  /** The admin's own way in: unlock a week nobody has asked about. */
  async function reopenWeek(pmId: string, week: string) {
    await send("/api/payments/reopen", "POST", { pmId, weekStart: week });
    router.refresh();
  }

  return (
    <PaymentsContext.Provider
      value={{
        me,
        pms,
        projects,
        paymentsRole,
        canWrite,
        rows,
        submissions,
        reopenRequests,
        saveRow,
        removeRow,
        submitWeek,
        markPaid,
        rejectRow,
        requestReopen,
        resolveReopenRequest,
        reopenWeek,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}
