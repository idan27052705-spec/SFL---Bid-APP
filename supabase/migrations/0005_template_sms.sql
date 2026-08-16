-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0005: SMS text on message templates.
-- Run in Supabase → SQL Editor, after 0004.
--
-- The Templates screen edits an email AND an SMS version of each
-- message. Text messaging isn't connected yet (Twilio is post-launch),
-- but the wording is written and stored now so it's ready, and so the
-- invite screen can show an accurate preview.
-- ════════════════════════════════════════════════════════════════════

alter table public.email_templates
  add column if not exists sms text;

-- Sensible starting text for the two templates that get sent.
update public.email_templates
set sms = 'SFL Builders Group: bid request for {trade} at {project}. Due {due_date}. Open {portal_url} — your code is {access_code}. Questions? {company_phone}'
where kind = 'invite' and sms is null;

update public.email_templates
set sms = 'SFL Builders Group: reminder — {trade} at {project} is due {due_date}. {portal_url} — code {access_code}. Can''t bid? Tap the link and tell us.'
where kind = 'reminder' and sms is null;

update public.email_templates
set sms = 'SFL Builders Group: you won the {trade} package at {project} at {price}. We''ll be in touch with the contract.'
where kind = 'award' and sms is null;
