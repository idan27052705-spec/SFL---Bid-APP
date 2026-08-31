-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0008: the weekly payment schedule.
-- Run in Supabase → SQL Editor, after 0007.
--
-- Every project manager writes down what they expect to pay in a week
-- and hands the week in by the Thursday before it starts. From that
-- moment the rows are somebody else's problem: whoever handles the money
-- pays them one at a time, attaching the bank confirmation, or sends one
-- back with a reason for the PM to fix.
--
-- Handing a week in is a signature, so it locks. It opens again only if
-- the PM asks and an admin agrees — that is what payment_reopen_requests
-- is for, and why nobody can quietly un-sign a week they already gave to
-- finance.
--
-- A row's state is never stored. Only two facts are recorded against it —
-- that it was paid, or that it was sent back — and everything before that
-- follows from whether its PM has signed the week. See paymentState() in
-- lib/payments.ts; the database must not grow a status column that can
-- disagree with it.
--
-- Nothing here is URL-facing (a week is addressed by its Monday and a row
-- only ever appears inside one), so no table carries short_id.
-- ════════════════════════════════════════════════════════════════════

-- ── payment rows (one expected payment) ─────────────────────────────
create table public.payment_rows (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  -- The Monday of the week this payment belongs to. Weeks run Mon–Sun.
  week_start      date not null,
  -- The day it is expected to go out — null when the PM only knows the
  -- week. Most payments are known by week and not by day: a PM filling
  -- Thursday's schedule knows the draw is due next week, not that it
  -- leaves on the Wednesday, and making them guess puts a date on the
  -- report that nobody meant.
  expected_date   date,
  -- restrict, not cascade: a payment row is a financial record, and
  -- offboarding the PM who wrote it must not erase what was paid. A
  -- profile with payment history simply cannot be deleted.
  pm_id           uuid not null references public.profiles(id) on delete restrict,
  -- Null when the PM typed a project that is not on the list; the name
  -- they typed is kept either way, so a row never loses what it was for.
  project_id      uuid references public.projects(id) on delete set null,
  project_name    text not null,
  pay_to          text,
  reason          text not null,
  amount          numeric not null check (amount > 0),

  -- Set by whoever handles the money, never by the PM. paid_on is the
  -- calendar day the money left, typed on the mark-paid form — not the
  -- moment the button was pressed.
  paid_on         date,
  paid_by         uuid references public.profiles(id) on delete set null,
  paid_method     text check (paid_method in ('Zelle', 'ACH', 'Wire transfer', 'Check', 'Cash')),
  -- Wire number, cheque number, whatever the bank calls it.
  paid_reference  text,

  rejected_at     timestamptz,
  rejected_by     uuid references public.profiles(id) on delete set null,
  rejection_reason text,

  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Paid and sent back are the two ends of the same fork: a row can be
  -- one or the other, never both. Marking a paid row rejected — or
  -- paying a row that was sent back without first clearing the
  -- rejection — would make paymentState() answer arbitrarily.
  check (paid_on is null or rejected_at is null)
);
create index on public.payment_rows (company_id, week_start);
create index on public.payment_rows (pm_id, week_start);

create trigger payment_rows_touch before update on public.payment_rows
  for each row execute function public.touch_updated_at();

-- ── week submissions (a PM's signature on a week) ───────────────────
-- The row IS the signature: one exists only for a week its PM has handed
-- in. Reopening deletes it, which is why there is no submitted_at to
-- blank out and no reopened_at here — who reopened a week, and when,
-- is on the request that asked for it.
create table public.payment_week_submissions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  pm_id        uuid not null references public.profiles(id) on delete cascade,
  week_start   date not null,
  submitted_at timestamptz not null default now(),
  unique (company_id, pm_id, week_start)
);

-- ── reopen requests (a PM asking for a signed week back) ────────────
-- A signature you can take back on your own is not one. The week report
-- is what the money gets paid from, so its totals have to be the totals
-- the PM stood behind when they signed — otherwise a week changes under
-- finance while they are paying it and nobody can say afterwards which
-- version was agreed. So the PM asks, with a message, and whoever handles
-- the money decides.
create table public.payment_reopen_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  pm_id       uuid not null references public.profiles(id) on delete cascade,
  week_start  date not null,
  message     text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  -- Approving is what deletes the submission above, so these two columns
  -- are also the record of who reopened that week and when.
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create index on public.payment_reopen_requests (company_id, status);

-- Asking twice replaces the first ask rather than stacking up: whoever
-- reads the approvals queue should see one line per week — the latest
-- thing the PM has to say about it, not a history of nagging. Resolved
-- requests stay on the record, so only the pending one is unique.
create unique index on public.payment_reopen_requests (company_id, pm_id, week_start)
  where status = 'pending';

-- ── proofs (evidence a payment actually went out) ───────────────────
-- Its own table, not the bid-scoped files table: those rows hang off a
-- project or a bid, and a payment has neither. One payment usually has
-- more than one file — the bank confirmation and the invoice it settles
-- — so a second screenshot must never quietly overwrite the first, which
-- a proof column on payment_rows would let it do.
--
-- storage_path is a key in the private bucket 0001 created; the file is
-- always handed out as a signed URL, never linked to directly.
create table public.payment_proofs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  payment_row_id uuid not null references public.payment_rows(id) on delete cascade,
  name           text not null,
  storage_path   text not null,
  size_bytes     bigint,
  mime_type      text,
  uploaded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.payment_proofs (payment_row_id);

-- ── who is finance ──────────────────────────────────────────────────
alter table public.profiles
  add column payments_role text not null default 'pm'
    check (payments_role in ('admin', 'pm'));

comment on column public.profiles.payments_role is
  'Every staff member is a project manager unless promoted, so this defaults to ''pm''. An owner is treated as a payments admin regardless of what this says — someone must always be able to pay a week and undo a mistake.';

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Same split as the rest of the app: RLS keeps one company out of
-- another's data and stops a viewer writing anything, and that is all it
-- tries to do. The rules that make the schedule work — a signed week is
-- locked, only its own PM may fix a row that was sent back, only an admin
-- marks a row paid or resolves a reopen request — are enforced in the API
-- routes, which own the whole picture (see lib/paymentsGuard.ts). Writing
-- them twice, in two languages, is how they drift apart.
--
-- As everywhere else, subs never reach these tables: no anon policy.
-- ════════════════════════════════════════════════════════════════════

alter table public.payment_rows             enable row level security;
alter table public.payment_week_submissions enable row level security;
alter table public.payment_reopen_requests  enable row level security;
alter table public.payment_proofs           enable row level security;

-- Everyone in the company reads; owner + staff write; viewer read-only.
do $$
declare t text;
begin
  foreach t in array array[
    'payment_rows','payment_week_submissions',
    'payment_reopen_requests','payment_proofs'
  ] loop
    execute format(
      'create policy %1$s_read on public.%1$s for select
         using (company_id = public.current_company_id())', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all
         using (company_id = public.current_company_id()
                and public.current_role_is(array[''owner'',''staff'']::public.user_role[]))
         with check (company_id = public.current_company_id())', t);
  end loop;
end $$;
