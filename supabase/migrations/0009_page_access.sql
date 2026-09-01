-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0009: two roles, and per-page access.
-- Run in Supabase → SQL Editor, after 0008.
--
-- The app now has exactly two roles a person can hold:
--
--   admin — runs the company, sees every page, always.
--   pm    — a project manager: sees only the pages ticked for them.
--
-- That role lives in profiles.app_role. The older profiles.role column
-- ('owner' | 'staff' | 'viewer') stays exactly where it is, because every
-- RLS policy in 0001 is written against it. It is now an internal detail
-- kept in step with app_role — admin writes as 'owner', pm writes as
-- 'staff' — and nothing in the interface mentions it again. Rewriting
-- every policy in the database to rename a role would risk the whole
-- app's isolation to change a word nobody sees.
--
-- Access is a plain list of page keys (see PAGES in app/config.ts). It is
-- enforced in the staff layout and in requireApiUser, so a page and its
-- API are gated by the same one value. Admins ignore the list entirely.
--
-- Safe to run twice.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists app_role text not null default 'pm'
    check (app_role in ('admin', 'pm'));

alter table public.profiles
  add column if not exists page_access text[] not null default '{}';

comment on column public.profiles.app_role is
  'admin or pm. The only role the interface shows. profiles.role is kept in step with it for RLS: admin -> owner, pm -> staff.';

comment on column public.profiles.page_access is
  'Page keys this person may open (see PAGES in app/config.ts). Ignored for an admin, who always sees everything. "account" is always allowed so nobody can be locked out of their own password.';

-- ── carry the existing team over ────────────────────────────────────
-- Everyone who could already write becomes an admin with everything
-- open, so nobody loses access the moment this runs. Existing viewers
-- become PMs and keep read access to what they had.
update public.profiles
   set app_role = case when role in ('owner', 'staff') then 'admin' else 'pm' end
 where app_role is null or app_role = 'pm';

update public.profiles
   set page_access = array[
     'dashboard','projects','bids','subs','payments',
     'account','company','trades','templates','reminders','team'
   ]
 where cardinality(page_access) = 0;

-- Whoever was already marked as handling the money stays an admin there.
update public.profiles
   set app_role = 'admin'
 where payments_role = 'admin';

-- ── keep the RLS column in step ─────────────────────────────────────
-- One trigger, so nothing can set app_role without role following. The
-- owner of the company is never demoted out of 'owner' by this: if they
-- are made a pm they become 'staff', and their RLS write access is the
-- same as any other project manager's.
create or replace function public.sync_role_from_app_role()
returns trigger
language plpgsql
as $$
begin
  if new.app_role = 'admin' then
    new.role := 'owner';
  else
    new.role := 'staff';
  end if;
  -- The payment schedule's own admin/pm split follows the app role.
  new.payments_role := new.app_role;
  return new;
end;
$$;

drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role
  before insert or update of app_role on public.profiles
  for each row execute function public.sync_role_from_app_role();
