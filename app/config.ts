/**
 * SFL Bid Desk — single source of truth for names, branding and copy.
 * CORE RULE: if a value appears in more than one file, it lives here.
 */

export const APP = {
  name: "SFL Bid Desk",
  shortName: "Bid Desk",
  brandLine1: "SFL BID DESK",
  brandLine2: "Builders Group",
  logo: "/sfl-logo.svg", // TODO: replace with the real PNG at public/sfl-logo.png and change this path,
  domain: "bids.sflbuildersgroup.com",
  portalUrl: "https://bids.sflbuildersgroup.com/portal",
} as const;

/**
 * Where the company works. Every date the app shows is computed here,
 * not where the server happens to run.
 */
export const TIMEZONE = "America/New_York";

export const COMPANY = {
  name: "SFL Builders Group",
  region: "South Florida",
  phone: "(954) 555-0100",
  fromEmail: "bids@sflbuildersgroup.com",
  replyTo: "office@sflbuildersgroup.com",
} as const;

/** Staff sidebar — key must match the route segment. */
/**
 * ─── Access ──────────────────────────────────────────────────────────
 *
 * Two roles, and nothing else:
 *
 *   admin — runs the company. Sees every page, always. An admin cannot
 *           be locked out of anything, which is what makes it safe to
 *           lock everyone else down.
 *   pm    — a project manager. Sees only the pages ticked on their own
 *           access page, and nothing more.
 *
 * Page access is a list of these keys on the profile. It is checked in
 * two places and only two: the staff layout (every page) and
 * requireApiUser (every API route). Adding a page here and to NAV is
 * all it takes for it to appear in the access list.
 */
export const APP_ROLES = ["admin", "pm"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  pm: "Project manager",
};

export const ROLE_NOTE: Record<AppRole, string> = {
  admin: "Full access to every page, including team and company settings.",
  pm: "Sees only the pages you tick below.",
};

export type PageKey =
  | "dashboard"
  | "projects"
  | "bids"
  | "subs"
  | "payments"
  | "account"
  | "company"
  | "trades"
  | "templates"
  | "reminders"
  | "team";

export const PAGES: {
  key: PageKey;
  label: string;
  href: string;
  /** Extra paths that belong to this page, for matching a URL. */
  also?: string[];
  group: "Work" | "Settings";
  /** Nobody can be locked out of these. */
  always?: boolean;
  note?: string;
}[] = [
  { key: "dashboard", label: "Dashboard", href: "/", group: "Work", also: ["/activity"] },
  { key: "projects", label: "Projects", href: "/projects", group: "Work" },
  { key: "bids", label: "Bids", href: "/bids", group: "Work" },
  { key: "subs", label: "Subs", href: "/subs", group: "Work" },
  {
    key: "payments",
    label: "Schedule Payments",
    href: "/payments",
    group: "Work",
    note: "Inside this page, Admin pays and sends back; a PM fills in their own week.",
  },
  {
    key: "account",
    label: "My account",
    href: "/settings/account",
    group: "Settings",
    always: true,
    note: "Everyone manages their own name, email and password.",
  },
  { key: "company", label: "Company details", href: "/settings/company", group: "Settings" },
  { key: "trades", label: "Trades", href: "/settings/trades", group: "Settings" },
  { key: "templates", label: "Templates", href: "/settings/templates", group: "Settings" },
  { key: "reminders", label: "Reminders", href: "/settings/reminders", group: "Settings" },
  { key: "team", label: "Team & roles", href: "/settings/team", group: "Settings" },
];

/** What a brand-new project manager gets before anyone edits them. */
export const DEFAULT_PM_ACCESS: PageKey[] = ["payments", "account"];

export const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/" },
  { key: "projects", label: "Projects", icon: "folder", href: "/projects" },
  { key: "bids", label: "Bids", icon: "file-text", href: "/bids" },
  { key: "subs", label: "Subs", icon: "users", href: "/subs" },
  { key: "payments", label: "Schedule Payments", icon: "banknote", href: "/payments" },
] as const;

export const NAV_SETTINGS = [
  { key: "account", label: "My account", icon: "user-round", href: "/settings/account" },
  { key: "company", label: "Company details", icon: "building-2", href: "/settings/company" },
  { key: "trades", label: "Trades", icon: "hammer", href: "/settings/trades" },
  { key: "templates", label: "Templates", icon: "mail", href: "/settings/templates" },
  { key: "reminders", label: "Reminders", icon: "bell", href: "/settings/reminders" },
  { key: "team", label: "Team & roles", icon: "user-cog", href: "/settings/team" },
] as const;

/** Seeded into the DB on first run; editable per company afterwards. */
export const DEFAULT_TRADES = [
  "Plumbing",
  "Electrical",
  "Mechanical (HVAC)",
  "Framing",
  "Drywall",
  "Roofing",
  "Impact Windows & Doors",
  "Tile",
  "Flooring",
  "Painting",
  "Concrete",
  "Stucco",
  "Demolition",
] as const;

/**
 * Project stages, in order. A project only ever moves forward on its own
 * (creating a bid, sending invitations, a price arriving) — it never moves
 * itself back, and it never touches Closed or Archived. Those two are
 * always a deliberate choice.
 */
export const PROJECT_STAGES = [
  "New",
  "Building bids",
  "Sent bids",
  "Review",
  "Closed",
  "Archived",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** Stages that mean "no longer being worked on". */
export const CLOSED_STAGES: readonly string[] = ["Closed", "Archived"];

/** How far along a stage is, for the "only move forward" rule. */
export const stageOrder = (stage: string) => {
  const i = (PROJECT_STAGES as readonly string[]).indexOf(stage);
  return i === -1 ? 0 : i;
};

export const BID_STATUSES = [
  "Draft",
  "Out for Bid",
  "Responses In",
  "Awarded",
  "Closed",
] as const;

export const INVITATION_STATUSES = [
  "Sent",
  "Viewed",
  "Received",
  "Denied",
  "No Response",
  "Expired",
] as const;


export const REMINDER_CADENCES = [
  "Off",
  "Every day",
  "Every 2 days",
  "Every 5 days",
  "Stopped",
] as const;

/**
 * The database's own role column, kept only because every RLS policy in
 * migration 0001 is written against it. It follows app_role
 * automatically (admin -> owner, pm -> staff) and is never shown to
 * anyone. Use APP_ROLES above for anything a person sees.
 */
export const ROLES = ["owner", "staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-US");
