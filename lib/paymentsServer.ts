import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { badRequest, forbidden, type ApiUser } from "@/lib/api";
import { weekStart as mondayOf } from "@/lib/weeks";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentRow,
  type ProofFile,
  type ReopenRequest,
} from "@/lib/payments";
import { canSeePage } from "@/lib/access";
import type { AppRole } from "@/app/config";
import { paymentsRoleOf, type PaymentsRole, type RowFacts } from "@/lib/paymentsGuard";

/**
 * The plumbing every /api/payments route shares.
 *
 * Two things live here and nowhere else: who the caller is *to the payment
 * schedule* (lib/api's requireApiUser knows the app's role but not
 * profiles.payments_role), and the translation between the database's
 * snake_case columns and the camelCase shapes in lib/payments that the
 * screens already speak. The permission rules themselves stay in
 * lib/paymentsGuard — this file only fetches the facts they need.
 */

/* ─────────────────────────────────────────────────────────────
   Who is asking
   ─────────────────────────────────────────────────────────── */

export type PaymentsUser = ApiUser & {
  paymentsRole: PaymentsRole;
  /** A viewer reads the schedule and changes nothing. RLS agrees. */
  canWrite: boolean;
};

/**
 * The signed-in staff member, plus their payments role.
 *
 * Same shape as requireApiUser — `{ user }` or `{ error }`, never a
 * redirect — but it reads one extra column, so routes don't have to make a
 * second round trip to find out whether the caller handles the money.
 * Identity always comes from the auth cookie, never from the request body.
 */
export async function requirePaymentsUser(): Promise<
  { user: PaymentsUser } | { error: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { error: badRequest("You are signed out. Sign in again.", 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, company_id, payments_role, app_role, page_access")
    .eq("id", user.id)
    .single();

  if (!profile)
    return { error: badRequest("Your account isn't attached to a company.", 403) };

  // Whoever handles the money is decided by the one app role now, so the
  // schedule can't disagree with the rest of the app about who is admin.
  const appRole = (profile.app_role as string) ?? "pm";

  /**
   * Someone without the Schedule Payments page has no business in its
   * API either — the page gate and this are the same one decision.
   */
  if (
    !canSeePage(
      { appRole: appRole as AppRole, pageAccess: (profile.page_access as string[]) ?? [] },
      "payments"
    )
  )
    return {
      error: forbidden("Your account doesn't have the payment schedule."),
    };

  return {
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      appRole: appRole as AppRole,
      pageAccess: (profile.page_access as string[]) ?? [],
      companyId: profile.company_id,
      paymentsRole: paymentsRoleOf(profile.role, appRole),
      canWrite: profile.role !== "viewer",
    },
  };
}

/** The refusal a non-admin gets from a finance-only route. */
export const notFinance = () =>
  forbidden("Only whoever handles the money can do that.");

/* ─────────────────────────────────────────────────────────────
   Reading and writing rows
   ─────────────────────────────────────────────────────────── */

/** Every column of payment_rows, as PostgREST hands it back. */
export type PaymentRowRecord = {
  id: string;
  company_id: string;
  week_start: string;
  expected_date: string | null;
  pm_id: string;
  project_id: string | null;
  project_name: string;
  pay_to: string | null;
  reason: string;
  amount: number | string;
  paid_on: string | null;
  paid_by: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProofRecord = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  mime_type: string | null;
};

export const ROW_COLUMNS =
  "id, company_id, week_start, expected_date, pm_id, project_id, project_name, " +
  "pay_to, reason, amount, paid_on, paid_by, paid_method, paid_reference, " +
  "rejected_at, rejected_by, rejection_reason, created_by, created_at, updated_at";

/**
 * supabase-js infers a row's shape by parsing the select string, and it
 * can only do that when the string is a literal at the call site. Ours is
 * a constant — one list, shared by every route that reads a row — so the
 * shape is asserted here, once, instead of at each of them.
 */
export const asRowRecord = (data: unknown) => data as PaymentRowRecord;
export const asReopenRecord = (data: unknown) => data as ReopenRecord;

/**
 * The same assertion for a whole list.
 *
 * The routes read one row at a time; the /payments layout reads the
 * company's entire schedule in one go and dresses it for the screens, so
 * it asserts the shape of a list rather than of a record.
 */
export const asRowRecords = (data: unknown) => (data ?? []) as PaymentRowRecord[];
export const asReopenRecords = (data: unknown) => (data ?? []) as ReopenRecord[];

/** A proof read alongside its row, so a list of them can be grouped. */
export type ProofRowRecord = ProofRecord & { payment_row_id: string };
export const asProofRecords = (data: unknown) => (data ?? []) as ProofRowRecord[];
export const PROOF_COLUMNS = "id, name, storage_path, size_bytes, mime_type";

/** The three facts the guard asks about, straight off a database row. */
export const factsOf = (row: PaymentRowRecord): RowFacts => ({
  pmId: row.pm_id,
  paid: row.paid_on !== null,
  rejected: row.rejected_at !== null,
});

/**
 * Names for a handful of profile ids.
 *
 * A row carries up to three people — its PM, whoever paid it, whoever sent
 * it back — and the screens show names, not uuids. Looked up in one query
 * rather than as three nested joins, because payment_rows has four foreign
 * keys into profiles and disambiguating them by constraint name is a
 * dependency on names nobody chose.
 */
export async function nameMap(
  supabase: SupabaseClient,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (wanted.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", wanted);

  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

const asMethod = (value: string | null): PaymentMethod | undefined =>
  PAYMENT_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : undefined;

/**
 * A stored proof, as the screens want it.
 *
 * The bucket is private, so `url` is the route that hands back a
 * short-lived signed URL for the object — never the object itself.
 */
export const toProofFile = (proof: ProofRecord): ProofFile => ({
  id: proof.id,
  name: proof.name,
  sizeBytes: proof.size_bytes ?? 0,
  type: proof.mime_type ?? "",
  url: `/api/payments/proofs/${proof.id}`,
});

/** One database row, in the shape lib/payments describes. */
export function toPaymentRow(
  record: PaymentRowRecord,
  names: Map<string, string>,
  proofs?: ProofRecord[]
): PaymentRow {
  return {
    id: record.id,
    weekStart: record.week_start,
    date: record.expected_date,
    pmId: record.pm_id,
    pmName: names.get(record.pm_id) ?? "",
    projectId: record.project_id,
    projectName: record.project_name,
    payTo: record.pay_to ?? "",
    reason: record.reason,
    amount: Number(record.amount),

    paidAt: record.paid_on ?? undefined,
    paidBy: record.paid_by ? names.get(record.paid_by) ?? undefined : undefined,
    paidMethod: asMethod(record.paid_method),
    paidReference: record.paid_reference ?? undefined,
    proofs: proofs ? proofs.map(toProofFile) : undefined,

    rejectedAt: record.rejected_at ?? undefined,
    rejectedBy: record.rejected_by
      ? names.get(record.rejected_by) ?? undefined
      : undefined,
    rejectionReason: record.rejection_reason ?? undefined,
  };
}

/**
 * Load one row and dress it for the response.
 *
 * Used by every route that changes a row, so the caller always gets back
 * the same shape it would have read in the first place.
 */
export async function readPaymentRow(
  supabase: SupabaseClient,
  id: string
): Promise<PaymentRow | null> {
  const { data: record } = await supabase
    .from("payment_rows")
    .select(ROW_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!record) return null;
  const row = asRowRecord(record);

  const { data: proofs } = await supabase
    .from("payment_proofs")
    .select("id, name, storage_path, size_bytes, mime_type")
    .eq("payment_row_id", row.id)
    .order("created_at", { ascending: true });

  const names = await nameMap(supabase, [row.pm_id, row.paid_by, row.rejected_by]);
  return toPaymentRow(row, names, (proofs ?? []) as ProofRecord[]);
}

export type ReopenRecord = {
  id: string;
  pm_id: string;
  week_start: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export const REOPEN_COLUMNS =
  "id, pm_id, week_start, message, status, created_at, resolved_at, resolved_by";

export const toReopenRequest = (
  record: ReopenRecord,
  names: Map<string, string>
): ReopenRequest => ({
  id: record.id,
  pmId: record.pm_id,
  pmName: names.get(record.pm_id) ?? "",
  weekStart: record.week_start,
  message: record.message,
  createdAt: record.created_at,
  status: record.status as ReopenRequest["status"],
  resolvedAt: record.resolved_at ?? undefined,
  resolvedBy: record.resolved_by
    ? names.get(record.resolved_by) ?? undefined
    : undefined,
});

/* ─────────────────────────────────────────────────────────────
   Weeks and signatures
   ─────────────────────────────────────────────────────────── */

/** Has this PM handed in this week? The submission row IS the signature. */
export async function weekIsSigned(
  supabase: SupabaseClient,
  companyId: string,
  pmId: string,
  week: string
): Promise<boolean> {
  const { data } = await supabase
    .from("payment_week_submissions")
    .select("id")
    .eq("company_id", companyId)
    .eq("pm_id", pmId)
    .eq("week_start", week)
    .maybeSingle();

  return !!data;
}

/* ─────────────────────────────────────────────────────────────
   Reading the request body
   ─────────────────────────────────────────────────────────── */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A week, normalised to its Monday.
 *
 * Weeks run Mon–Sun and are addressed by their Monday everywhere else, so
 * any day inside the week names the same week rather than being rejected.
 * Normalising rather than refusing keeps two routes given the same input
 * — add a row, then sign the week — agreeing about which week that was.
 */
export function readWeek(value: unknown): string | null {
  const raw = String(value ?? "").slice(0, 10);
  if (!ISO_DAY.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))
    return null;
  return mondayOf(raw);
}

/** A plain calendar day, or null. Never a moment a timezone could shift. */
export function readDay(value: unknown): string | null {
  const raw = String(value ?? "").slice(0, 10);
  if (!ISO_DAY.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))
    return null;
  return raw;
}

export const readText = (value: unknown): string => String(value ?? "").trim();

/** Money. Must be a real number above zero — the table checks this too. */
export function readAmount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const readMethod = (value: unknown): PaymentMethod | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value);
  return PAYMENT_METHODS.includes(raw as PaymentMethod)
    ? (raw as PaymentMethod)
    : undefined;
};
