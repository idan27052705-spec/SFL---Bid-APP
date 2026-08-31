"use client";

import { createContext, useContext, useState } from "react";
import type {
  PM,
  PaymentRow,
  Project,
  ProofFile,
  ReopenRequest,
  WeekSubmission,
} from "@/lib/payments";

export type PaidDetails = {
  paidAt: string;
  reference: string;
  proof: ProofFile | null;
};

type PaymentsContextValue = {
  me: PM;
  pms: PM[];
  projects: Project[];
  isOwner: boolean;
  canWrite: boolean;
  /** Whoever handles the money sees the approvals screen. */
  isFinance: boolean;
  rows: PaymentRow[];
  submissions: WeekSubmission[];
  reopenRequests: ReopenRequest[];
  saveRow: (row: PaymentRow) => void;
  removeRow: (id: string) => void;
  setSubmitted: (week: string, at: string | null) => void;
  markPaid: (id: string, details: PaidDetails) => void;
  rejectRow: (id: string, reason: string) => void;
  requestReopen: (week: string, message: string) => void;
  resolveReopenRequest: (id: string, approved: boolean) => void;
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

export function usePayments(): PaymentsContextValue {
  const value = useContext(PaymentsContext);
  if (!value) throw new Error("usePayments must be used inside PaymentsProvider");
  return value;
}

/**
 * Holds the payment data for every screen under /payments.
 *
 * It lives in the layout rather than in any one page, because the layout
 * is what survives navigating between the week list, a week, and the
 * approvals queue. While the rows are only in memory that is the
 * difference between keeping what someone just typed and throwing it
 * away — and once this is on Supabase, this is where the fetching and the
 * mutations go.
 */
export default function PaymentsProvider({
  me,
  pms,
  projects,
  isOwner,
  canWrite,
  isFinance,
  initialRows,
  initialSubmissions,
  initialReopenRequests = [],
  children,
}: {
  me: PM;
  pms: PM[];
  projects: Project[];
  isOwner: boolean;
  canWrite: boolean;
  isFinance: boolean;
  initialRows: PaymentRow[];
  initialSubmissions: WeekSubmission[];
  initialReopenRequests?: ReopenRequest[];
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState(initialRows);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [reopenRequests, setReopenRequests] = useState(initialReopenRequests);

  /**
   * Editing a row that was sent back clears the rejection, which puts it
   * straight back in the finance queue. That is the whole loop: there is
   * no separate "resubmit" button to forget to press.
   */
  function saveRow(row: PaymentRow) {
    const cleaned: PaymentRow = {
      ...row,
      rejectedAt: undefined,
      rejectedBy: undefined,
      rejectionReason: undefined,
    };
    setRows((list) =>
      list.some((r) => r.id === cleaned.id)
        ? list.map((r) => (r.id === cleaned.id ? cleaned : r))
        : [...list, cleaned]
    );
  }

  function removeRow(id: string) {
    setRows((list) => list.filter((r) => r.id !== id));
  }

  function markPaid(id: string, { paidAt, reference, proof }: PaidDetails) {
    setRows((list) =>
      list.map((r) =>
        r.id === id
          ? {
              ...r,
              paidAt,
              paidBy: me.name,
              paidReference: reference || undefined,
              proof: proof ?? undefined,
              rejectedAt: undefined,
              rejectedBy: undefined,
              rejectionReason: undefined,
            }
          : r
      )
    );
  }

  function rejectRow(id: string, reason: string) {
    setRows((list) =>
      list.map((r) =>
        r.id === id
          ? {
              ...r,
              rejectedAt: new Date().toISOString(),
              rejectedBy: me.name,
              rejectionReason: reason,
            }
          : r
      )
    );
  }

  function setSubmitted(week: string, at: string | null) {
    setSubmissions((list) => {
      const found = list.some((s) => s.pmId === me.id && s.weekStart === week);
      if (!found) return [...list, { pmId: me.id, weekStart: week, submittedAt: at }];
      return list.map((s) =>
        s.pmId === me.id && s.weekStart === week ? { ...s, submittedAt: at } : s
      );
    });
  }

  /**
   * A PM cannot un-submit themselves, so this is the only way a locked week
   * opens again: they ask, with a reason, and it lands in the approvals
   * queue. Asking a second time replaces the first rather than stacking up,
   * because whoever reads that queue should see one line per week — the
   * latest thing the PM has to say about it, not a history of nagging.
   */
  function requestReopen(week: string, message: string) {
    const request: ReopenRequest = {
      id: `reopen-${me.id}-${week}-${Date.now()}`,
      pmId: me.id,
      pmName: me.name,
      weekStart: week,
      message,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    setReopenRequests((list) => [
      ...list.filter(
        (r) =>
          !(r.pmId === me.id && r.weekStart === week && r.status === "pending")
      ),
      request,
    ]);
  }

  /**
   * Approving is the one thing that clears a submission — the week drops
   * back to Draft for that PM, who edits it and signs it again, so the
   * report never sits in a half-state where it is neither handed in nor
   * being worked on. Declining leaves the signature standing and keeps the
   * request on the record, with a name against the decision.
   */
  function resolveReopenRequest(id: string, approved: boolean) {
    const request = reopenRequests.find((r) => r.id === id);
    if (!request) return;

    setReopenRequests((list) =>
      list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: approved ? ("approved" as const) : ("declined" as const),
              resolvedAt: new Date().toISOString(),
              resolvedBy: me.name,
            }
          : r
      )
    );

    if (!approved) return;
    setSubmissions((list) =>
      list.map((s) =>
        s.pmId === request.pmId && s.weekStart === request.weekStart
          ? { ...s, submittedAt: null }
          : s
      )
    );
  }

  return (
    <PaymentsContext.Provider
      value={{
        me,
        pms,
        projects,
        isOwner,
        canWrite,
        isFinance,
        rows,
        submissions,
        reopenRequests,
        saveRow,
        removeRow,
        setSubmitted,
        markPaid,
        rejectRow,
        requestReopen,
        resolveReopenRequest,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}
