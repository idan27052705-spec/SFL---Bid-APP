-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0010: the email a new teammate gets.
-- Run in Supabase → SQL Editor, after 0009.
--
-- The other three templates are written to subcontractors — people
-- outside the company being asked to price work. This one goes to your
-- own project managers, so it lives apart from them on the Templates
-- page and has its own merge fields. Mixing them would mean editing the
-- wording your subs read while trying to change what your staff read.
--
-- Safe to run twice.
-- ════════════════════════════════════════════════════════════════════

insert into public.email_templates (company_id, kind, subject, body)
select
  c.id,
  'team_invite',
  'Your {company_name} account is ready',
  E'Hi {name},\n\n{invited_by} has set up an account for you on {company_name}''s bid desk.\n\nSign in here:\n{sign_in_url}\n\nEmail: {email}\nTemporary password: {temporary_password}\n\nChange that password as soon as you are in — My account, top of the menu. It only exists so you can get in the first time.\n\nYou have been added as: {role}\n\n— {company_name}'
from public.companies c
on conflict (company_id, kind) do nothing;
