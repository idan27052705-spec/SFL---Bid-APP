-- ── Portal sign-in rate limiting ──────────────────────────────────────
-- The access code is six digits — a million combinations, which a script
-- can walk through in minutes. The old limiter counted attempts in the
-- server's memory, but the app runs on serverless: every cold start is a
-- fresh empty counter, so in practice it stopped nothing.
--
-- Counting has to live here instead. The key is a hash of the address
-- they typed plus their IP, so no email address is stored in this table.
--
-- Safe to run twice.

create table if not exists public.portal_login_attempts (
  key           text primary key,
  count         integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);

-- No policies on purpose: only the service role (the API routes) touches
-- this, and RLS with no policy denies everyone else.
alter table public.portal_login_attempts enable row level security;

/**
 * Records one sign-in attempt and reports whether the account is locked.
 * Returns the time the lock lifts, or null when the attempt may proceed.
 * Row-locked, so two simultaneous guesses can't both slip past the cap.
 */
create or replace function public.portal_login_attempt(p_key text, p_max integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.portal_login_attempts%rowtype;
  lock_for constant interval := interval '15 minutes';
  window_len constant interval := interval '15 minutes';
begin
  insert into public.portal_login_attempts (key) values (p_key)
    on conflict (key) do nothing;

  select * into rec from public.portal_login_attempts where key = p_key for update;

  -- Already locked: don't extend it, just report when it lifts.
  if rec.locked_until is not null and rec.locked_until > now() then
    return rec.locked_until;
  end if;

  -- A quiet spell wipes the slate — a wrong code last week means nothing.
  if rec.window_start < now() - window_len then
    update public.portal_login_attempts
       set count = 1, window_start = now(), locked_until = null
     where key = p_key;
    return null;
  end if;

  if rec.count + 1 >= p_max then
    update public.portal_login_attempts
       set count = rec.count + 1, locked_until = now() + lock_for
     where key = p_key;
    return now() + lock_for;
  end if;

  update public.portal_login_attempts set count = rec.count + 1 where key = p_key;
  return null;
end;
$$;

/** Called after a correct code — the sub starts clean next time. */
create or replace function public.portal_login_clear(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.portal_login_attempts where key = p_key;
$$;

revoke all on function public.portal_login_attempt(text, integer) from anon, authenticated;
revoke all on function public.portal_login_clear(text) from anon, authenticated;
