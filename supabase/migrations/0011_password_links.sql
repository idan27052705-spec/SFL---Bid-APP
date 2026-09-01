-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0011: one-time links instead of typed-out passwords.
-- Run in Supabase → SQL Editor, after 0010.
--
-- A new teammate now gets a link and chooses their own password, and
-- anyone can ask for that link again from the sign-in page. So the
-- invitation stops carrying a password in plain text — whoever could
-- read that inbox could use it — and a second template is added for the
-- reset.
--
-- The invitation body is only rewritten if it still contains the
-- temporary password we used to send. If it has been edited since, it is
-- left exactly as written, and only the field name needs changing by
-- hand on the Templates page.
--
-- Safe to run twice.
-- ════════════════════════════════════════════════════════════════════

update public.email_templates
   set body = E'Hi {name},\n\n{invited_by} has set up an account for you on {company_name}''s bid desk.\n\nChoose your password here — the link works once and expires in an hour:\n{set_password_url}\n\nYou sign in from then on with this address: {email}\n\nYou have been added as: {role}\n\nQuestions? Call the office on {company_phone}.\n\n— {company_name}'
 where kind = 'team_invite'
   and body like '%{temporary_password}%';

insert into public.email_templates (company_id, kind, subject, body)
select
  c.id,
  'password_reset',
  'Set a new {company_name} password',
  E'Hi {name},\n\nSomebody asked to reset the password for {email}.\n\nSet a new one here — the link works once and expires in an hour:\n{set_password_url}\n\nIf that wasn''t you, ignore this email. Your password stays as it is, and nobody can use the link but you.\n\n— {company_name}'
from public.companies c
on conflict (company_id, kind) do nothing;
