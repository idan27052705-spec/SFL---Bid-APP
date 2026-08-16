# SFL Bid Desk — Architecture

Single source of truth for how this app is built. **Update this file in the same change whenever you add a page, table, API route, shared component, integration, or env var.**

---

## What it is

Bid management for SFL Builders Group. SFL staff create projects and bid packages, invite subcontractors, track who opened and who priced, then compare and award. Subs log into a separate mobile-first portal to view the package and submit a quote.

Live at `bids.sflbuildersgroup.com`.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | CSS variables + design-system classes in `app/globals.css`; Tailwind available |
| Icons | `lucide-react` |
| Database | Supabase (Postgres + Auth + Storage) — *Session 2* |
| Email | Resend — *Session 6* |
| Hosting | Vercel |

## Core rules

1. **Everything changes from one place.** Colors → `:root` in `app/globals.css`. Names, nav, statuses, trades → `app/config.ts`. Never hardcode a repeated value.
2. **No mock data past Session 2.** Every field is backed by a real column.
3. **Two audiences, two sessions.** Staff auth (Supabase Auth cookie) and sub portal auth (email + access code) never share a session.
4. **Files are private.** The `bid-files` bucket is private — verified that both the public URL and the anon key are refused. Downloads go through `GET /api/files/:id`, which returns a 10-minute signed URL. Storage paths are `companyId/projects/projectId/uuid.ext` — never the user's filename.
5. **Denying keeps the record.** Ruling a sub out sets the invitation to Denied with a reason and leaves their price in place — removing the invitation would erase what they actually quoted. `DELETE /api/invitations/:id` refuses once a price exists.
6. **Awarded bids are frozen.** Once a package is awarded, the scope a sub priced can't shift underneath them — the Edit button is hidden, the edit page redirects, and `POST /api/bids/save` refuses.
7. **Modals**: centred, no page scroll, `z-index: 70`, red `*` on required fields, calendar picker for dates, reset on open, click-outside closes.

## Design system

Ported from the "Industry" system in the Claude Design file. Tokens live in `:root`. Component classes available globally: `.btn` (`.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-icon` / `.btn-block`), `.card` (+ `.card-kicker` / `.card-title` / `.card-body` / `.card-meta`), `.input`, `.field`, `.tag` (+ `-accent` / `-accent-2` / `-neutral` / `-outline`), `.table`, `.dialog` / `.dialog-backdrop`, `.navlink`, `.tab`, `.rowlink`, `.app` / `.side` / `.pagehead` / `.pagebody`, `.elev-sm|md|lg`, `.text-muted`, `.mono`.

Look: square corners, hairline borders, transparent fills. Headings in Barlow Condensed, body in Barlow. Accent `#5980a6`.

## Routes

### Staff — route group `app/(staff)`, sidebar layout
| Route | Status |
|---|---|
| `/` | Dashboard — **built** — KPIs, "gone quiet" nudge list with one-click resend, out-for-pricing table, activity feed |
| `/projects` | **built** — search, status filter, New project modal |
| `/projects/[id]` | **built** — bid packages, files, description, details, activity |
| `/bids` | **built** — all packages, search, status filter, responses count |
| `/bids/[id]` | **built** — scope, line items, drawings, subs invited, activity |
| `/projects/[id]/bids/new`, `/bids/[id]/edit` | **built** — the bid builder (shared `components/BidBuilder.tsx`) |
| `/bids/[id]/invite` | **built** — pick subs (trade-filtered), select all, send real emails |
| `/bids/[id]/compare` | **built** — prices sorted low first, low-bid tag, gap over low, award / rule out |
| `/subs` | **built** — search, trade filter, Add sub modal, code issued once |
| `/subs/[id]` | **built** — details, bid history, portal access / regenerate code |
| `/activity` | planned (S8) |
| `/settings/trades`, `/settings/templates`, `/settings/reminders`, `/settings/team` | planned |
| `/login` | **built** — email + password, Supabase Auth |

### Sub portal — route group `app/(portal)`, no sidebar, mobile-first, EN/ES
| Route | Status |
|---|---|
| `/portal` | **built** — sign in with email/phone + 6-digit code |
| `/portal/open/[token]` | **built** — one-tap link from an email: signs in, stamps viewed, opens the bid |
| `/portal/bids` | **built** — the whole dashboard: Bids waiting / Submitted / Past |
| `/portal/bids/[id]` | **built** — scope, line items, drawings, send price or can't-bid |

## API routes

**Built:** `POST /api/account` (own name/email/password) · `POST /api/projects` ·
`POST /api/projects/:shortId/files` · `GET|DELETE /api/files/:id` (signed URL / delete) ·
`POST /api/subs` · `POST /api/subs/:shortId/code` · `POST /api/bids/save` (create + update) · `POST /api/bids/:shortId/invitations` · `POST /api/invitations/:id/resend` · `POST /api/invitations/:id/deny` · `DELETE /api/invitations/:id` · `POST /api/bids/:shortId/award`

Every route: identity from the auth cookie only, `viewer` rejected on writes,
company scoping through RLS.

**Planned:** `PATCH /api/bids/:id` · `POST /api/bids/:id/invitations` · `POST /api/bids/:id/award`
`POST /api/invitations/:id/resend` · `POST /api/invitations/:id/deny` · `DELETE /api/invitations/:id` · `POST /api/bids/:shortId/award` · `POST /api/invitations/:id/messages` · `POST /api/invitations/:id/comments` · `POST /api/invitations/:id/deny`
`POST /api/subs` · `POST /api/subs/:id/code`
`POST /api/portal/session` · `POST /api/portal/bids/:id/view` · `POST /api/portal/bids/:id/response` · `POST /api/portal/bids/:id/decline` · `POST /api/portal/profile/change-requests`
**Portal (built):** `POST /api/portal/session` · `POST /api/portal/logout` · `POST /api/portal/bids/:shortId/response` · `POST /api/portal/bids/:shortId/decline` · `GET /api/portal/files/:id`

Portal routes run on the service-role client (subs have no database account), so every one of them scopes reads and writes through the signed-in sub's own invitation.

**Planned:** `POST /api/portal/profile/change-requests` · `POST /api/change-requests/:id/approve|decline` · `PATCH /api/settings/trades`

## Database — **live**

Supabase project `cxgmvaonfnfxviaqtdcu`. Migrations in `supabase/migrations/`
(`0001_init.sql` schema + RLS + storage bucket, `0002_seed.sql` company, trades,
settings, email templates).

Migrations `0003_bid_files.sql` adds `bid_files`; `0004_access_code_recoverable.sql` adds `subs.access_code_enc`.
`0003` (a drawing can be on several packages).

Tables: `companies`, `users`, `projects`, `trades`, `bids`, `bid_line_items`, `subs`, `invitations`, `responses`, `response_line_items`, `messages`, `comments` (internal only), `change_requests`, `files`, `activity`, `settings`, `email_templates`.

Every URL-facing table carries `short_id SERIAL UNIQUE`.

## Shared components

| Component | Purpose |
|---|---|
| `components/Sidebar.tsx` | Staff left nav — reads `NAV` / `NAV_SETTINGS` from `app/config.ts`; shows signed-in user, role and Sign out |
| `lib/supabase/client.ts` | Browser client (anon key, RLS applies) |
| `lib/supabase/server.ts` | Server client for pages and API routes (runs as the signed-in user) |
| `lib/supabase/admin.ts` | Service-role client — **portal routes only**, bypasses RLS, must check ownership first |
| `lib/supabase/middleware.ts` | Refreshes the auth cookie, redirects signed-out users to `/login` |
| `lib/auth.ts` | `requireUser()`, `canWrite()`, `assertCanWrite()` — role gate (`viewer` is read-only) |
| `middleware.ts` | Route guard. Public: `/login`, `/auth`, `/portal`, `/api/portal` |
| `lib/api.ts` | `requireApiUser()`, `badRequest()`, `forbidden()`, `notFound()` for API routes |
| `lib/format.ts` | `money`, `formatDate`, `formatDateShort`, `timeAgo`, `formatBytes`, `fileKind` |
| `lib/accessCode.ts` | Issue / verify / reveal sub access codes. Stored **encrypted** (AES-256-GCM, key derived from `PORTAL_TOKEN_SECRET`) plus a salted hash for sign-in — the office must be able to tell a sub their code |
| `lib/email.ts` | Resend wrapper, `{merge}` template rendering, plain-text → branded HTML |
| `lib/portalToken.ts` | Signed one-tap portal links. HMAC of invitation id + sub `session_epoch`, computed not stored — regenerating a code kills every old link |
| `lib/portalSession.ts` | Signed sub cookie (sub id + session epoch), re-checked against the database on every request |
| `lib/portalStrings.ts` | All portal copy, English and Spanish |
| `app/portal/PortalShell.tsx` | Portal chrome — one column, big targets, EN/ES toggle, sign out |
| `app/(staff)/NudgeList.tsx` | Dashboard "gone quiet" rows with a one-click Nudge |
| `components/BidBuilder.tsx` | Bid builder used by both new and edit — trade, due date, title, scope, line items, drawing picker, cadence |
| `components/Modal.tsx` | House modal + `ModalField` — centred, z-70, Esc + click-outside close, body scroll locked |

## Auth

- **Staff**: Supabase Auth email + password, HTTP-only cookie, refreshed in middleware.
  `profiles` links the auth user to a company and a role (`owner` / `staff` / `viewer`).
  `POST /auth/signout` clears the session.
- **Subs**: no Supabase account. Email/phone + 6-digit access code, verified server-side
  against `subs.access_code_hash`. Portal routes use the service-role client and must
  check ownership on every record. `subs.session_epoch` invalidates live sessions when a
  code is regenerated. *(portal itself built in S7)*
- **Access codes are recoverable by design.** They behave like a password the office
  issues, so every invitation and reminder email carries the sub's own code and the sub
  page displays it. Trade-off accepted knowingly: a database leak alone still reveals
  nothing (the key lives only in the server environment), but this is weaker than a
  one-way hash.
- **Portal links**: `/portal/open/<token>` — one tap from the email, no code typing.
  Tied to one invitation and one sub; dies when the code is regenerated.

## Env vars

See `.env.example`. All four are set in Vercel (Production + Preview) and in local `.env.local`. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.

## Integrations

| Integration | Status |
|---|---|
| Supabase | **connected** — project `cxgmvaonfnfxviaqtdcu` |
| Resend (email) | **live** — domain `sflbuildersgroup.com` verified, sending from `bids@sflbuildersgroup.com` |
| Twilio (SMS) | deferred — after launch |
