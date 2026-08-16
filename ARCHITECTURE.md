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
4. **Files are private.** Storage bucket is private; all downloads go through signed URLs.
5. **Modals**: centred, no page scroll, `z-index: 70`, red `*` on required fields, calendar picker for dates, reset on open, click-outside closes.

## Design system

Ported from the "Industry" system in the Claude Design file. Tokens live in `:root`. Component classes available globally: `.btn` (`.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-icon` / `.btn-block`), `.card` (+ `.card-kicker` / `.card-title` / `.card-body` / `.card-meta`), `.input`, `.field`, `.tag` (+ `-accent` / `-accent-2` / `-neutral` / `-outline`), `.table`, `.dialog` / `.dialog-backdrop`, `.navlink`, `.tab`, `.rowlink`, `.app` / `.side` / `.pagehead` / `.pagebody`, `.elev-sm|md|lg`, `.text-muted`, `.mono`.

Look: square corners, hairline borders, transparent fills. Headings in Barlow Condensed, body in Barlow. Accent `#5980a6`.

## Routes

### Staff — route group `app/(staff)`, sidebar layout
| Route | Status |
|---|---|
| `/` | Dashboard — **built** (live counts, build progress) |
| `/projects`, `/projects/[id]` | planned (S4) |
| `/bids`, `/bids/[id]`, `/bids/[id]/builder`, `/bids/[id]/invite`, `/bids/[id]/compare` | planned (S5, S6, S8) |
| `/subs`, `/subs/[id]` | planned (S4) |
| `/activity` | planned (S8) |
| `/settings/trades`, `/settings/templates`, `/settings/reminders`, `/settings/team` | planned |
| `/login` | **built** — email + password, Supabase Auth |

### Sub portal — route group `app/(portal)`, no sidebar, mobile-first, EN/ES
| Route | Status |
|---|---|
| `/portal` (login), `/portal/bids`, `/portal/bids/[id]`, `/portal/bids/[id]/quote`, `/portal/bids/[id]/decline`, `/portal/profile` | planned (S7) |

## API routes (planned — names taken from the design's data layer)

`POST /api/projects` · `POST /api/projects/:id/files` · `POST /api/projects/:id/bids`
`PATCH /api/bids/:id` · `POST /api/bids/:id/invitations` · `POST /api/bids/:id/award`
`POST /api/invitations/:id/resend` · `DELETE /api/invitations/:id` · `POST /api/invitations/:id/messages` · `POST /api/invitations/:id/comments` · `POST /api/invitations/:id/deny`
`POST /api/subs` · `POST /api/subs/:id/code`
`POST /api/portal/session` · `POST /api/portal/bids/:id/view` · `POST /api/portal/bids/:id/response` · `POST /api/portal/bids/:id/decline` · `POST /api/portal/profile/change-requests`
`POST /api/change-requests/:id/approve|decline` · `PATCH /api/settings/trades`

## Database — **live**

Supabase project `cxgmvaonfnfxviaqtdcu`. Migrations in `supabase/migrations/`
(`0001_init.sql` schema + RLS + storage bucket, `0002_seed.sql` company, trades,
settings, email templates).

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

## Auth

- **Staff**: Supabase Auth email + password, HTTP-only cookie, refreshed in middleware.
  `profiles` links the auth user to a company and a role (`owner` / `staff` / `viewer`).
  `POST /auth/signout` clears the session.
- **Subs**: no Supabase account. Email/phone + 6-digit access code, verified server-side
  against `subs.access_code_hash`. Portal routes use the service-role client and must
  check ownership on every record. `subs.session_epoch` invalidates live sessions when a
  code is regenerated. *(built in S7)*

## Env vars

See `.env.example`. All four are set in Vercel (Production + Preview) and in local `.env.local`. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.

## Integrations

| Integration | Status |
|---|---|
| Supabase | **connected** — project `cxgmvaonfnfxviaqtdcu` |
| Resend (email) | not connected (S6) |
| Twilio (SMS) | deferred — after launch |
