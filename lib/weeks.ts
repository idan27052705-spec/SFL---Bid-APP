import { today } from "@/lib/dates";

/**
 * Week arithmetic for the payment schedule.
 *
 * A week here runs Monday through Sunday, and a week's schedule is due
 * the Thursday before it starts. Dates are plain YYYY-MM-DD calendar
 * days — the same convention as lib/dates.ts — so they are added and
 * compared as days, never as moments a timezone could shift onto the
 * wrong side of midnight.
 */

const DAY = 86400000;
const asUtc = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function addDays(date: string, n: number): string {
  return toIso(asUtc(date) + n * DAY);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(asUtc(date)).getUTCDay(); // 0 = Sunday
  return d === 0 ? 7 : d;
}

/** The Monday of the week containing that date. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export const addWeeks = (monday: string, n: number) => addDays(monday, n * 7);

/** The seven days of a week, Monday first. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * The week to open the page on.
 *
 * PMs fill next week's schedule on Thursday, so from Thursday onward the
 * week worth looking at is the one ahead. Monday to Wednesday it's the
 * week being paid right now.
 */
export function defaultWeekStart(): string {
  const now = today();
  const monday = weekStart(now);
  return isoWeekday(now) >= 4 ? addWeeks(monday, 1) : monday;
}

/** Schedules for a week are due the Thursday before it starts. */
export const submissionDeadline = (monday: string) => addDays(monday, -4);

/** "Mon · Sep 1" — the day column. */
export function dayLabel(date: string): string {
  const [, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${SHORT_DAYS[isoWeekday(date) - 1]} · ${MONTHS[m - 1]} ${d}`;
}

/** "Monday" — the day group heading. */
export const dayName = (date: string) => LONG_DAYS[isoWeekday(date) - 1];

/** "Sep 1 – Sep 7, 2026" — the week navigator. */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const [, m1, d1] = monday.split("-").map(Number);
  const [y2, m2, d2] = sunday.split("-").map(Number);
  const from = `${MONTHS[m1 - 1]} ${d1}`;
  const to = m1 === m2 ? `${d2}` : `${MONTHS[m2 - 1]} ${d2}`;
  return `${from} – ${to}, ${y2}`;
}

/** "Thursday, Aug 27" — the deadline line. */
export function deadlineLabel(monday: string): string {
  const due = submissionDeadline(monday);
  const [, m, d] = due.split("-").map(Number);
  return `${dayName(due)}, ${MONTHS[m - 1]} ${d}`;
}

/** Past, current or future, relative to the week we're standing in today. */
export function weekOffset(monday: string): number {
  return Math.round((asUtc(monday) - asUtc(weekStart(today()))) / (7 * DAY));
}

/** "This week", "Next week", "3 weeks ago" — so a date range has a meaning. */
export function relativeWeekLabel(monday: string): string {
  const n = weekOffset(monday);
  if (n === 0) return "This week";
  if (n === 1) return "Next week";
  if (n === -1) return "Last week";
  return n > 0 ? `In ${n} weeks` : `${Math.abs(n)} weeks ago`;
}
