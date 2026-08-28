"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WeekReport from "../WeekReport";
import { weekStart } from "@/lib/weeks";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One week's schedule, at its own address: /payments/2026-08-31
 *
 * The segment is the Monday. Any other day of that week redirects to the
 * Monday, so a link someone typed by hand still lands somewhere sensible
 * and every week has exactly one URL.
 */
export default function WeekPage({ params }: { params: { week: string } }) {
  const router = useRouter();
  const raw = params.week;

  const valid = ISO_DATE.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`));
  const monday = valid ? weekStart(raw) : null;

  useEffect(() => {
    if (monday && monday !== raw) router.replace(`/payments/${monday}`);
  }, [monday, raw, router]);

  if (!valid) {
    return (
      <div className="pagebody" style={{ padding: "40px 28px" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>That is not a week</h1>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          A week address looks like <code>/payments/2026-08-31</code>.
        </p>
        <Link className="btn btn-secondary" href="/payments">
          Back to all weeks
        </Link>
      </div>
    );
  }

  return <WeekReport week={monday!} />;
}
