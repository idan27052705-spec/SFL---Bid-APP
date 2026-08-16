-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — seed. Run once, after 0001_init.sql.
-- Creates the SFL Builders Group company, its trade list, settings and
-- the three email templates. No fake projects, bids or subs — Idan
-- enters real ones.
-- ════════════════════════════════════════════════════════════════════

insert into public.companies (name, phone, from_email)
values ('SFL Builders Group', '(954) 555-0100', 'bids@sflbuildersgroup.com')
on conflict do nothing;

with c as (select id from public.companies where name = 'SFL Builders Group' limit 1)
insert into public.trades (company_id, name, position)
select c.id, t.name, t.pos
from c, (values
  ('Plumbing', 1),
  ('Electrical', 2),
  ('Mechanical (HVAC)', 3),
  ('Framing', 4),
  ('Drywall', 5),
  ('Roofing', 6),
  ('Impact Windows & Doors', 7),
  ('Tile', 8),
  ('Flooring', 9),
  ('Painting', 10),
  ('Concrete', 11),
  ('Stucco', 12),
  ('Demolition', 13)
) as t(name, pos)
on conflict (company_id, name) do nothing;

with c as (select id from public.companies where name = 'SFL Builders Group' limit 1)
insert into public.settings (company_id, default_cadence, reminder_cap)
select c.id, 'Every 2 days', 5 from c
on conflict (company_id) do nothing;

-- Email templates. {placeholders} are filled in at send time.
with c as (select id from public.companies where name = 'SFL Builders Group' limit 1)
insert into public.email_templates (company_id, kind, subject, body)
select c.id, v.kind, v.subject, v.body
from c, (values
  (
    'invite',
    'Bid request — {trade} at {project}',
    E'Hi {contact},\n\nSFL Builders Group is requesting a price from {sub_company} for {trade} on {project} in {city}.\n\nScope: {bid_title}\nBids are due {due_date}.\n\nOpen the package, download the drawings and send your price here:\n{portal_url}\n\nYour access code is {access_code}\nSign in with this email address and that code.\n\nQuestions? Call the office at {company_phone}.\n\n— {company_name}'
  ),
  (
    'reminder',
    'Reminder — {trade} bid at {project} is due {due_date}',
    E'Hi {contact},\n\nWe still need your price for {trade} on {project}. Bids are due {due_date}.\n\n{portal_url}\nAccess code: {access_code}\n\nIf you can''t bid this one, open the link and tap "Can''t bid" so we stop the reminders.\n\n— {company_name}'
  ),
  (
    'award',
    'You won the {trade} package — {project}',
    E'Hi {contact},\n\nGood news. SFL Builders Group is awarding the {trade} package on {project} to {sub_company} at {price}.\n\nWe''ll be in touch with the contract and schedule.\n\n— {company_name}'
  )
) as v(kind, subject, body)
on conflict (company_id, kind) do nothing;
