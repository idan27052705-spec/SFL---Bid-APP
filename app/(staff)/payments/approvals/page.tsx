"use client";

import ApprovalsQueue from "../ApprovalsQueue";

/**
 * /payments/approvals — the finance queue.
 *
 * A static segment, so it wins over /payments/[week] and no date can
 * ever collide with it.
 */
export default function ApprovalsPage() {
  return <ApprovalsQueue />;
}
