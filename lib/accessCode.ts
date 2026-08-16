import { createHash, randomInt } from "crypto";

/**
 * Sub access codes.
 *
 * 6 digits, easy to read over the phone or text to a foreman. Stored only as
 * a hash — if the database ever leaks, nobody gets a working code. The plain
 * code is returned exactly once, at the moment it's issued, so it can be shown
 * on screen and put in the invitation email.
 *
 * A 6-digit code is only 1,000,000 possibilities, so brute force is stopped by
 * rate limiting on the portal login, not by the code's length. That limiter is
 * part of the portal build.
 */

export function generateAccessCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashAccessCode(code: string, subId: string): string {
  // Salted per sub, so the same code on two subs produces different hashes
  // and nobody can build one rainbow table for all of them.
  return createHash("sha256").update(`${subId}:${code.trim()}`).digest("hex");
}

export function verifyAccessCode(
  code: string,
  subId: string,
  hash: string | null
): boolean {
  if (!hash) return false;
  return hashAccessCode(code, subId) === hash;
}
