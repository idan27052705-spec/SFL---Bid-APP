/**
 * The spreadsheet look — a border on every cell, the way the cost
 * breakdown on the project page already does it. Shared by the week
 * index and the week report so the two tables read as one thing.
 */

export const cell: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid var(--color-divider)",
};

export const headCell: React.CSSProperties = {
  ...cell,
  textAlign: "left",
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export const numCell: React.CSSProperties = {
  ...cell,
  textAlign: "right",
  whiteSpace: "nowrap",
};

export const subtotalCell: React.CSSProperties = {
  ...cell,
  background: "color-mix(in srgb, var(--color-text) 4%, transparent)",
  fontSize: 12,
};

export const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";
export const FAINT = "color-mix(in srgb, var(--color-text) 45%, transparent)";

/**
 * The one red in the app — a row sent back, a deadline missed, a payment
 * that should already have gone out. It is spent sparingly on purpose: a
 * screen where three things are red is a screen where nothing is.
 */
export const DANGER = "#b3261e";
/** The same red as a wash, for a chip that has to carry it as a background. */
export const DANGER_TINT = `color-mix(in srgb, ${DANGER} 14%, transparent)`;
