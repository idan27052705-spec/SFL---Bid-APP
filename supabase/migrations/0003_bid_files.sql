-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0003: attach files to bids.
-- Run in Supabase → SQL Editor, after 0001 and 0002.
--
-- A drawing uploaded to a project can be included in several bid
-- packages (the MEP set goes to plumbing AND mechanical), so the link
-- is a join table rather than a column on files.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.bid_files (
  bid_id   uuid not null references public.bids(id) on delete cascade,
  file_id  uuid not null references public.files(id) on delete cascade,
  position int not null default 0,
  primary key (bid_id, file_id)
);

create index if not exists bid_files_bid_idx on public.bid_files (bid_id);

alter table public.bid_files enable row level security;

create policy bid_files_read on public.bid_files for select
  using (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id()));

create policy bid_files_write on public.bid_files for all
  using (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id())
         and public.current_role_is(array['owner','staff']::public.user_role[]))
  with check (exists (select 1 from public.bids b
                 where b.id = bid_id and b.company_id = public.current_company_id()));
