# SFL Bid Desk — full page-by-page review

Reviewed 2026-08-17 against the live code. Every staff page, every portal
page, the modals inside them, and the button/text details on each.

**Severity**

- **P0** — wrong or unsafe. Fix before real bids go out.
- **P1** — will bite you in normal use.
- **P2** — polish and consistency.

Two items were fixed during the review and are marked **[fixed]**.

---

## Summary — the ten that matter

| # | Page | Issue | Sev |
|---|------|-------|-----|
| 1 | Bid detail → Subs | **Remove** deletes an invitation with no confirmation | P0 |
| 2 | Portal (all) | Staff "Preview as sub" counted as the sub opening the bid **[fixed]** | P0 |
| 3 | Everywhere | Reminder cadence is stored and displayed but **nothing ever sends a reminder** | P0 |
| 4 | Staff login | `?next=` is followed without checking — an off-site link would be obeyed | P1 |
| 5 | Projects list | Stage colours never match the real stages — every stage looks grey | P1 |
| 6 | Dashboard | Dates are computed in the server's timezone, not Florida's | P1 |
| 7 | Bid detail | Award uses a browser pop-up; Compare uses a proper modal | P1 |
| 8 | Bid detail → Subs | **Send again** emails a sub instantly, no confirmation | P1 |
| 9 | Sub portal | The "what do you want changed" field list is English-only in Spanish | P1 |
| 10 | Staff app | No password reset anywhere | P1 |

---

# Staff app

## `/login`

Clean and correct: real Supabase Auth, one honest error ("That email and
password don't match") that doesn't leak whether the address exists.

- **P1 — the `next` parameter is followed blindly.** After sign-in the page
  goes to whatever `?next=` says. `…/login?next=https://example.com` would
  send you off-site after you type your password. Only relative paths
  starting with a single `/` should be accepted.
- **P1 — no "forgot password".** If you lock yourself out, the only way back
  is the Supabase dashboard. This needs to exist before anyone else has an
  account.
- **P2 —** the logo's alt text uses the hardcoded company name rather than
  the one now saved in Settings.

## `/` — Dashboard

The strongest page in the app. Four stats, bids out for pricing with a
two-tone progress bar, who to chase, what's due, recent activity. Empty
states are written properly everywhere.

- **P1 — dates are computed on the server, in the server's timezone.**
  Vercel runs in UTC, so after about 8pm Florida time the header date and
  the "due in N days" line roll over to tomorrow. Every date shown to you
  should be computed in `America/New_York`.
- **P1 — "Due this week" silently includes overdue bids.** The card says
  "closing within seven days", but a bid that closed last week counts too,
  and its row shows a weekday from the past. Overdue deserves its own
  count — it's the thing you'd actually want to see.
- **P2 —** "Reminders" column shows the cadence, which reads like a promise
  the app doesn't keep (see #3 below).
- **P2 —** the whole page loads every bid and every invitation on each
  visit. Fine now; will need a limit around a few hundred bids.

## `/projects` — Projects list

Search, stage filter, a genuinely good empty state.

- **P1 — the stage colours are dead code.** The tag styling still tests for
  `Awarded` and `Bidding`, which aren't stages any more. Every stage — New,
  Building bids, Sent bids, Review, Closed, Archived — renders the same grey.
  The filter buttons work; only the colour is wrong.
- **P2 — no row actions.** Subs now have Edit on the row and bids have View
  bid; projects have neither. Editing means opening the project first.
- **P2 —** rows aren't clickable, only the project name is. The other three
  list pages use full-row `clickrow` styling.

## `/projects/[id]` — Project detail

Five tabs (Overview, Bids, Cost summary, Files, Activity), stage dropdown,
Edit and Archive. Cost summary's "carried" total — awarded price where you
awarded, low price everywhere else — is the right number to show.

- **P1 — Delete file uses a browser pop-up.** `ProjectFiles` calls the
  native `confirm()`. The house rule is a real modal; it also can't be
  styled or translated, and on some phones it's easy to fat-finger.
- **P2 —** the Bids tab has no "View bid" action, unlike `/bids`.
- **P2 —** an archived project hides "New bid" but the stage dropdown still
  offers every stage, so it's not obvious archiving is meant to be an end
  state.
- **P2 —** Cost summary shows nothing at all until a price arrives; a line
  explaining that would beat an empty panel.

**Modals here:** `ProjectModal` (create + edit, one form) and
`ProjectActions`. Both follow the house rules — centred, Escape closes,
click-outside closes, required fields marked, errors clear as you type.

## `/projects/[id]/bids/new` and `/bids/[id]/edit` — Bid builder

Shared `BidBuilder`. Scope, line items, drawings, photos and video, due
date, cadence. The file picker bug you hit is fixed and uploads now go
straight from the browser to storage, so a 30 MB plan set works.

- **P2 —** there's no "unsaved changes" warning. Closing the tab mid-build
  loses everything typed.
- **P2 —** line items have no reordering; they stay in the order added.

## `/bids` — Bids list

Search plus the new View bid button.

- **P2 — the search box doesn't say what it searches.** It matches project,
  trade and status, not sub names, which is what you'd guess.
- **P2 —** no stage/status filter, unlike Projects and Subs.

## `/bids/[id]` — Bid detail

Tabs for scope, files, the subs invited, prices in, and activity.

- **P0 — "Remove" deletes an invitation instantly, no confirmation.** One
  mis-tap on a phone and the sub is off the bid. Everything else
  destructive in the app asks first.
- **P1 — "Send again" fires a real email the moment it's tapped.** Sending
  a message to an outside contractor should be confirmed. It's also next to
  Remove, which makes the mis-tap worse.
- **P1 — Award here uses a browser pop-up**, while awarding from Compare
  uses a proper modal. Same decision, two different experiences; the
  browser one can't show the price you're about to commit to.
- **P2 —** the three row actions are text-only and identically weighted, so
  the dangerous one doesn't look dangerous.

## `/bids/[id]/invite` — Invite subs

Trade-filtered list, live email preview, SMS preview correctly tagged "Not
connected yet", already-invited subs disabled with the reason shown.

- **P2 —** with nothing selected the button reads "Send 0 invitations" and
  is still clickable; it errors when tapped. It should be disabled.
- **P2 —** subs with no email are greyed out with "no email on file", but
  there's no way to fix that from here — you have to leave, edit the sub,
  and come back.

## `/bids/[id]/compare` — Compare

The best-built screen in the app. A matrix you read across, low bid
tagged, gap over low, award and rule-out both behind proper modals with a
required reason. The award result message is honest — it tells you when
the email didn't go out and to call them instead.

- **P2 —** the deny modal keeps a stale error visible until the next
  submit.

## `/subs` and `/subs/[id]`

List with search and trade filter, access code visible, Edit on every row
(added today). Detail page has bid history, response-rate stats, access
code panel, requested changes, Preview as sub.

- **P1 — "Preview as sub" left footprints. [fixed]** Because a preview used
  a normal portal session, the office opening a bid marked it as *the sub*
  having opened it — which corrupted the "never opened" counts on the
  dashboard and the chase list. Preview sessions are now marked: they don't
  stamp anything, they can't submit a price or a change request, and the
  portal shows a banner saying it's a preview.
- **P2 —** "Regenerate code" signs the sub out of every device
  immediately. True and necessary, but the button doesn't say so.

## `/activity`

Straight reverse-chronological log, capped at 200.

- **P2 —** no filter by type or date, and no "load more" past 200.

## `/settings/account`

Correct on the rules: everyone edits their own name, email and password;
nobody can touch anyone else's. Password change requires the current one.

## `/settings/company` (new)

Owner edits, staff and viewers read-only, live footer preview. Feeds the
emails and the portal.

- **P2 —** no logo upload yet; the logo is still the placeholder SVG.
- **P2 —** the "Send from" address must be on the Resend-verified domain.
  The form checks the format but can't check the domain, so a wrong entry
  fails silently at send time.

## `/settings/trades`, `/settings/templates`

Trades are data, not code — right call, and usage counts show before you
retire one. Templates are editable per kind with a merge-field reference
and live preview.

- **P2 — [fixed]** the merge-field help called `{portal_url}` a "one-tap
  link". Since subs now have to enter their code, it's relabelled.

## `/settings/reminders`

- **P0 — this page promises automation that does not exist.** You can set
  a cadence and a cap, every bid displays its cadence, and the dashboard
  has a Reminders column — but nothing in the app ever sends a reminder on
  its own. The only reminders that go out are the ones you send by hand.
  This is the largest gap between what the app says and what it does.
  Until the scheduled job exists, the page should say so plainly, the same
  way SMS is tagged "Not connected yet".

## `/settings/team`

Roles listed with last-active, owner-only editing.

- **P2 —** no way to invite a new team member from the UI; accounts have
  to be created in Supabase.

---

# Sub portal

## `/portal` — Sign in

Email + 6-digit code, EN/ES, email pre-filled when they arrive from an
invitation link, expired-link message. Padding and sizing verified at
375px and 768px.

## `/portal/bids` — Their dashboard

Exactly as asked: what's waiting, what they've sent, what's finished.
Cards are big and thumb-sized.

- **P2 —** no indication of which bids are closing soonest beyond the due
  tag; a "closes tomorrow" emphasis would help.

## `/portal/bids/[id]` — The bid

Scope, line items, drawings as a list, photos as a 4-across square gallery,
one big price button, and a "can't bid" path so they can decline.

- **P2 —** subs price the package as one number; they can't price line by
  line even when you've listed items. Worth deciding before you promise it
  to anyone.
- **P2 —** no confirmation step after submitting a price — it saves
  immediately. For a number this consequential, a "you're sending $X"
  check is worth it.

## `/portal/profile` — My info

They request a change, you approve it. Correct design — a sub shouldn't be
able to rewrite their own record.

- **P1 — the field list is English even in Spanish.** "Company name",
  "Contact name", "Email", "Phone", "City" are hardcoded, so a
  Spanish-speaking sub gets a Spanish page with an English dropdown.

---

# Cross-cutting

1. **Reminders don't send.** Repeated because it's the big one.
2. **SMS isn't connected** — correctly tagged everywhere it appears.
3. **Timezone.** Every date is computed where the server runs, not in
   Florida. Affects the dashboard, due dates and "days overdue".
4. **Two confirmation styles.** Browser pop-ups in two places, proper
   modals everywhere else. Pick the modal.
5. **Destructive actions aren't visually distinct** — Remove looks exactly
   like Preview.
6. **No rate limiting** on the portal sign-in. Six digits is 1,000,000
   combinations, but nothing slows down guessing.
7. **The logo is still a placeholder** in the sidebar, both sign-in pages
   and every email header.

## What's genuinely good

The permission model is enforced on the server, not just hidden in the UI.
Portal routes all scope through the signed-in sub's own invitation. Files
are private with signed URLs. Access codes are encrypted but recoverable,
which is what you asked for. Empty states are written like a person wrote
them. Compare and the dashboard are better than most paid tools I've seen
at this stage.
