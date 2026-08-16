-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — initial schema
-- Run once in Supabase → SQL Editor.
--
-- Shape follows the prototype's data layer:
--   projects · trades · bids · subs · invitations · responses · activity
-- plus messages (sub sees), comments (internal only), change_requests,
-- files, settings, email_templates.
--
-- Every URL-facing table carries short_id SERIAL UNIQUE.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── companies ───────────────────────────────────────────────────────
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  short_id      serial unique,
  name          text not null,
  phone         text,
  from_email    text,
  created_at    timestamptz not null default now()
);

-- ── users (mirrors auth.users) ──────────────────────────────────────
create type public.user_role as enum ('owner', 'staff', 'viewer');

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  company_id     uuid not null references public.companies(id) on delete cascade,
  name           text not null,
  email          text not null,
  role           public.user_role not null default 'staff',
  last_active_at timestamptz,
  created_at     timestamptz not null default now()
);
create index on public.profiles (company_id);

-- ── trades ──────────────────────────────────────────────────────────
create table public.trades (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index on public.trades (company_id);

-- ── projects ────────────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  short_id    serial unique,
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  address     text,
  city        text,
  county      text,
  client      text,
  type        text,
  status      text not null default 'Draft',
  start_date  date,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.projects (company_id, status);

-- ── subs (subcontractors) ───────────────────────────────────────────
create table public.subs (
  id                uuid primary key default gen_random_uuid(),
  short_id          serial unique,
  company_id        uuid not null references public.companies(id) on delete cascade,
  company_name      text not null,
  contact_name      text,
  email             text,
  phone             text,
  city              text,
  status            text not null default 'Active',
  -- access code is NEVER stored in plain text
  access_code_hash  text,
  code_issued_at    timestamptz,
  code_last_used_at timestamptz,
  -- bumping this invalidates every live portal session for this sub
  session_epoch     int not null default 1,
  created_at        timestamptz not null default now()
);
create index on public.subs (company_id);
create index on public.subs (lower(email));

create table public.sub_trades (
  sub_id   uuid not null references public.subs(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  primary key (sub_id, trade_id)
);

-- ── bids ────────────────────────────────────────────────────────────
create table public.bids (
  id             uuid primary key default gen_random_uuid(),
  short_id       serial unique,
  company_id     uuid not null references public.companies(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  trade_id       uuid references public.trades(id) on delete set null,
  title          text not null,
  due_date       date,
  status         text not null default 'Draft',
  cadence        text not null default 'Every 2 days',
  scope          text,
  awarded_sub_id uuid references public.subs(id) on delete set null,
  awarded_at     timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.bids (company_id, status);
create index on public.bids (project_id);

create table public.bid_line_items (
  id          uuid primary key default gen_random_uuid(),
  bid_id      uuid not null references public.bids(id) on delete cascade,
  description text not null,
  detail      text,
  qty         numeric default 1,
  unit        text default 'lot',
  position    int not null default 0
);
create index on public.bid_line_items (bid_id);

-- ── files (private bucket; always served via signed URL) ────────────
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  bid_id       uuid references public.bids(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  size_bytes   bigint,
  mime_type    text,
  kind         text not null default 'doc',   -- doc | photo | video
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.files (project_id);
create index on public.files (bid_id);

-- ── invitations ─────────────────────────────────────────────────────
create table public.invitations (
  id             uuid primary key default gen_random_uuid(),
  short_id       serial unique,
  company_id     uuid not null references public.companies(id) on delete cascade,
  bid_id         uuid not null references public.bids(id) on delete cascade,
  sub_id         uuid not null references public.subs(id) on delete cascade,
  status         text not null default 'Sent',
  sent_at        timestamptz not null default now(),
  viewed_at      timestamptz,
  reminders      int not null default 0,
  last_reminder_at timestamptz,
  decline_reason text,
  created_at     timestamptz not null default now(),
  unique (bid_id, sub_id)
);
create index on public.invitations (bid_id);
create index on public.invitations (sub_id);
create index on public.invitations (company_id, status);

-- ── responses (one quote per invitation) ────────────────────────────
create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  price         numeric,
  lead_time     text,
  exclusions    text,
  notes         text,
  file_id       uuid references public.files(id) on delete set null,
  submitted_at  timestamptz not null default now()
);

create table public.response_line_items (
  id               uuid primary key default gen_random_uuid(),
  response_id      uuid not null references public.responses(id) on delete cascade,
  bid_line_item_id uuid references public.bid_line_items(id) on delete set null,
  description      text not null,
  qty              numeric,
  unit             text,
  price            numeric,
  added_by_sub     boolean not null default false,
  position         int not null default 0
);
create index on public.response_line_items (response_id);

-- ── messages (both sides see these) ─────────────────────────────────
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  from_side     text not null check (from_side in ('gc', 'sub')),
  author_name   text,
  author_id     uuid references public.profiles(id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index on public.messages (invitation_id, created_at);

-- ── comments (INTERNAL ONLY — subs must never see these) ────────────
create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  author_name   text,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index on public.comments (invitation_id, created_at);

-- ── change requests (sub asks, staff approves) ──────────────────────
create table public.change_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  sub_id      uuid not null references public.subs(id) on delete cascade,
  field       text not null,
  value       text not null,
  note        text,
  status      text not null default 'Pending',  -- Pending | Approved | Declined
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.change_requests (company_id, status);

-- ── activity feed ───────────────────────────────────────────────────
create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type       text not null,   -- created | sent | viewed | received | denied | awarded | updated
  text       text not null,
  meta       text,
  project_id uuid references public.projects(id) on delete cascade,
  bid_id     uuid references public.bids(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.activity (company_id, created_at desc);

-- ── settings (one row per company) ──────────────────────────────────
create table public.settings (
  company_id       uuid primary key references public.companies(id) on delete cascade,
  default_cadence  text not null default 'Every 2 days',
  reminder_cap     int  not null default 5,
  custom_fields    jsonb not null default '[]'::jsonb
);

create table public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind       text not null,   -- invite | reminder | award
  subject    text not null,
  body       text not null,
  unique (company_id, kind)
);

-- ── updated_at triggers ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger bids_touch before update on public.bids
  for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Staff read/write only inside their own company. Subs never touch the
-- database directly — the portal goes through server routes using the
-- service-role key, which bypasses RLS after checking the sub's session
-- itself. So there is deliberately NO anon policy anywhere below.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role_is(check_roles public.user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(check_roles)
  )
$$;

alter table public.companies       enable row level security;
alter table public.profiles        enable row level security;
alter table public.trades          enable row level security;
alter table public.projects        enable row level security;
alter table public.subs            enable row level security;
alter table public.sub_trades      enable row level security;
alter table public.bids            enable row level security;
alter table public.bid_line_items  enable row level security;
alter table public.files           enable row level security;
alter table public.invitations     enable row level security;
alter table public.responses       enable row level security;
alter table public.response_line_items enable row level security;
alter table public.messages        enable row level security;
alter table public.comments        enable row level security;
alter table public.change_requests enable row level security;
alter table public.activity        enable row level security;
alter table public.settings        enable row level security;
alter table public.email_templates enable row level security;

-- companies: read own only
create policy companies_read on public.companies
  for select using (id = public.current_company_id());

-- profiles: read own company; only owners may write
create policy profiles_read on public.profiles
  for select using (company_id = public.current_company_id());
create policy profiles_write on public.profiles
  for all using (company_id = public.current_company_id()
                 and public.current_role_is(array['owner']::public.user_role[]))
       with check (company_id = public.current_company_id());

-- Company-scoped tables: everyone in the company reads;
-- owner + staff write; viewer is read-only.
do $$
declare t text;
begin
  foreach t in array array[
    'trades','projects','subs','bids','files','invitations',
    'change_requests','activity','settings','email_templates'
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

-- Child tables reach the company through their parent.
create policy sub_trades_read on public.sub_trades for select
  using (exists (select 1 from public.subs s
                 where s.id = sub_id and s.company_id = public.current_company_id()));
create policy sub_trades_write on public.sub_trades for all
  using (exists (select 1 from public.subs s
                 where s.id = sub_id and s.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.subs s
                 where s.id = sub_id and s.company_id = public.current_company_id()));

create policy bid_line_items_read on public.bid_line_items for select
  using (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id()));
create policy bid_line_items_write on public.bid_line_items for all
  using (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id()));

create policy responses_read on public.responses for select
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));
create policy responses_write on public.responses for all
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));

create policy response_line_items_read on public.response_line_items for select
  using (exists (select 1 from public.responses r
                 join public.invitations i on i.id = r.invitation_id
                 where r.id = response_id and i.company_id = public.current_company_id()));
create policy response_line_items_write on public.response_line_items for all
  using (exists (select 1 from public.responses r
                 join public.invitations i on i.id = r.invitation_id
                 where r.id = response_id and i.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.responses r
                 join public.invitations i on i.id = r.invitation_id
                 where r.id = response_id and i.company_id = public.current_company_id()));

create policy messages_read on public.messages for select
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));
create policy messages_write on public.messages for all
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));

create policy comments_read on public.comments for select
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));
create policy comments_write on public.comments for all
  using (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.invitations i
                 where i.id = invitation_id and i.company_id = public.current_company_id()));

-- ── private storage bucket for drawings, photos and quotes ──────────
insert into storage.buckets (id, name, public)
values ('bid-files', 'bid-files', false)
on conflict (id) do nothing;

create policy "staff read bid-files" on storage.objects
  for select to authenticated
  using (bucket_id = 'bid-files');

create policy "staff write bid-files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bid-files');

create policy "staff update bid-files" on storage.objects
  for update to authenticated
  using (bucket_id = 'bid-files');

create policy "staff delete bid-files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bid-files');
