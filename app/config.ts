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

export const COMPANY = {
  name: "SFL Builders Group",
  region: "South Florida",
  phone: "(954) 555-0100",
  fromEmail: "bids@sflbuildersgroup.com",
  replyTo: "office@sflbuildersgroup.com",
} as const;

/** Staff sidebar — key must match the route segment. */
export const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/" },
  { key: "projects", label: "Projects", icon: "folder", href: "/projects" },
  { key: "bids", label: "Bids", icon: "file-text", href: "/bids" },
  { key: "subs", label: "Subs", icon: "users", href: "/subs" },
] as const;

export const NAV_SETTINGS = [
  { key: "account", label: "My account", icon: "user-round", href: "/settings/account" },
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

export const ROLES = ["owner", "staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-US");
