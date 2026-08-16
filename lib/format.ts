/** Shared display helpers. Keep formatting in one place. */

export const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US");

/** "Aug 21, 2026" — dates from Postgres arrive as YYYY-MM-DD. */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Aug 21" for tight columns. */
export function formatDateShort(value: string | null | undefined) {
  const full = formatDate(value);
  return full === "—" ? full : full.replace(/,\s\d{4}$/, "");
}

/** "2 hours ago", "Yesterday", "Aug 12" — for activity and timestamps. */
export function timeAgo(value: string | null | undefined) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDateShort(new Date(then).toISOString());
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Which viewer/icon a file gets. */
export function fileKind(mime: string | null | undefined, name: string) {
  const m = (mime || "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/.test(n)) return "photo";
  if (m.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(n)) return "video";
  return "doc";
}
