import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Cross-site request protection.
 *
 * Session cookies are SameSite=Lax, which already blocks the classic
 * cross-site form POST. This is the belt to that pair of braces: any
 * state-changing request must come from our own origin.
 *
 * Checked on the Origin header, falling back to Referer. A request with
 * neither (curl, a webhook, a native app) is allowed only if it isn't
 * carrying a browser session — those routes do their own auth anyway.
 */
export function wrongOrigin(): NextResponse | null {
  const h = headers();
  const origin = h.get("origin");
  const referer = h.get("referer");
  const host = h.get("host");

  if (!host) return null;
  if (!origin && !referer) return null;

  const source = origin ?? referer!;
  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (sourceHost !== host) {
    return NextResponse.json(
      { error: "That request didn't come from this site." },
      { status: 403 }
    );
  }

  return null;
}

/**
 * URL segments like /bids/12 must be positive whole numbers.
 * Without this, /bids/abc becomes Number("abc") = NaN and reaches the
 * database as a malformed query.
 */
export function shortId(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}
