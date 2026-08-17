import { TIMEZONE } from "@/app/config";

/**
 * Dates, computed where the company actually is.
 *
 * These pages are rendered on a server that runs on UTC, so anything
 * derived from `new Date()` was five hours ahead of Fort Lauderdale.
 * After about 7pm the dashboard called it tomorrow, and "due in 2 days"
 * quietly became "due in 1 day". Every day-level calculation goes
 * through here instead.
 *
 * Due dates are stored as plain YYYY-MM-DD — a calendar day, not a
 * moment — so they're compared as strings and never turned into a
 * timestamp that a timezone could shift.
 */

/** Today where the company is, as YYYY-MM-DD. */
export function today(): string {
  // en-CA formats as YYYY-MM-DD, which sorts and subtracts cleanly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/** Whole days from today until that date. Negative means overdue. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return null;

  const DAY = 86400000;
  const asUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
  return Math.round((asUtc(target) - asUtc(today())) / DAY);
}

export const isOverdue = (date: string | null | undefined) => {
  const d = daysUntil(date);
  return d != null && d < 0;
};

/** "in 3 days", "today", "2 days overdue" — the line under a due date. */
export function dueLabel(date: string | null | undefined): string {
  const d = daysUntil(date);
  if (d == null) return "";
  if (d < 0) return `${Math.abs(d)} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

/** "Monday, August 17, 2026" — the dashboard's header line. */
export function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** The weekday of a due date, in company time. */
export function weekdayShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
}
