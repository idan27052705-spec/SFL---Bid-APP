"use client";

import { createContext, useContext, useState } from "react";
import type {
  PM,
  PaymentRow,
  Project,
  ProofFile,
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
  saveRow: (row: PaymentRow) => void;
  removeRow: (id: string) => void;
  setSubmitted: (week: string, at: string | null) => void;
  markPaid: (id: string, details: PaidDetails) => void;
  rejectRow: (id: string, reason: string) => void;
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
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState(initialRows);
  const [submissions, setSubmissions] = useState(initialSubmissions);

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
        saveRow,
        removeRow,
        setSubmitted,
        markPaid,
        rejectRow,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}
