-- ── Company details ───────────────────────────────────────────────────
-- Everything that identifies the company on an email, the sub portal and
-- a bid invitation. It used to be hardcoded in app/config.ts, so changing
-- a phone number meant a code change and a deploy.
--
-- Safe to run twice.

alter table public.companies add column if not exists region        text;
alter table public.companies add column if not exists address       text;
alter table public.companies add column if not exists city          text;
alter table public.companies add column if not exists state         text;
alter table public.companies add column if not exists zip           text;
alter table public.companies add column if not exists license_number text;
alter table public.companies add column if not exists website       text;
alter table public.companies add column if not exists reply_to_email text;

-- Fill the existing company with what config.ts has been using, so
-- nothing changes the moment this runs.
update public.companies
set region      = coalesce(region, 'South Florida'),
    phone       = coalesce(phone, '(954) 555-0100'),
    from_email  = coalesce(from_email, 'bids@sflbuildersgroup.com'),
    reply_to_email = coalesce(reply_to_email, 'office@sflbuildersgroup.com');

-- Only an owner may change company-wide identity: it goes out on every
-- email to every sub. Staff and viewers can read it.
drop policy if exists companies_update_owner on public.companies;
create policy companies_update_owner on public.companies
  for update using (
    id = public.current_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );
