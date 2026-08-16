-- ════════════════════════════════════════════════════════════════════
-- SFL Bid Desk — 0004: make access codes recoverable.
-- Run in Supabase → SQL Editor, after 0003.
--
-- The access code works like a password the office issues, so staff must
-- be able to see it and put it in every invitation email. It is now
-- stored encrypted (AES-256-GCM, key derived from PORTAL_TOKEN_SECRET
-- which lives only in the server environment) in addition to the salted
-- hash used for sign-in.
--
-- Any sub whose code was issued before this migration has no encrypted
-- copy — their code genuinely cannot be recovered, so the app shows
-- "issue a new code" for them.
-- ════════════════════════════════════════════════════════════════════

alter table public.subs
  add column if not exists access_code_enc text;

comment on column public.subs.access_code_enc is
  'AES-256-GCM iv.tag.ciphertext of the 6-digit access code. Key is derived from PORTAL_TOKEN_SECRET and never stored in the database.';
