import { PAGES, type PageKey, type AppRole } from "@/app/config";

/**
 * Who may open what.
 *
 * One file answers it for pages and for API routes alike, so a screen and
 * the endpoint behind it can never disagree about whether someone is
 * allowed in. Both callers ask the same two questions: which page is this
 * URL, and does this person have it.
 */

export type Access = {
  appRole: AppRole;
  pageAccess: string[];
};

/** An admin has everything; "account" is open to everyone, always. */
export function canSeePage(user: Access, key: PageKey): boolean {
  if (user.appRole === "admin") return true;
  if (PAGES.find((p) => p.key === key)?.always) return true;
  return user.pageAccess.includes(key);
}

/** The pages this person may open, in menu order. */
export const allowedPages = (user: Access) =>
  PAGES.filter((p) => canSeePage(user, p.key));

/**
 * Which page a URL belongs to.
 *
 * Matches the longest href first, so /settings/team wins over "/" and a
 * detail page like /projects/12 lands on its section. Returns null for
 * anything outside the map — /login, the sub portal, uploads — which the
 * callers treat as "not access-controlled here".
 */
export function pageOfPath(path: string): PageKey | null {
  if (path === "/") return "dashboard";

  const candidates = PAGES.flatMap((p) =>
    [p.href, ...(p.also ?? [])].map((href) => ({ key: p.key, href }))
  )
    .filter((c) => c.href !== "/")
    .sort((a, b) => b.href.length - a.href.length);

  const hit = candidates.find(
    (c) => path === c.href || path.startsWith(c.href + "/")
  );
  return hit?.key ?? null;
}

/**
 * Which page an API route belongs to.
 *
 * /api/projects/12/files is the projects page; /api/payments/... is the
 * payment schedule. Anything unmapped — account, uploads, files, portal —
 * is left alone, because those either belong to everyone or carry their
 * own checks.
 */
const API_PAGES: [string, PageKey][] = [
  ["/api/projects", "projects"],
  ["/api/bids", "bids"],
  ["/api/subs", "subs"],
  ["/api/invitations", "bids"],
  ["/api/change-requests", "subs"],
  ["/api/payments", "payments"],
  ["/api/company", "company"],
  ["/api/team", "team"],
  ["/api/settings", "trades"],
];

export function pageOfApiPath(path: string): PageKey | null {
  const hit = API_PAGES.find(
    ([prefix]) => path === prefix || path.startsWith(prefix + "/")
  );
  return hit?.[1] ?? null;
}

/** Where to send someone who has no business on the page they asked for. */
export function firstAllowedHref(user: Access): string {
  const pages = allowedPages(user).filter((p) => !p.always);
  return pages[0]?.href ?? "/settings/account";
}
