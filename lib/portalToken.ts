import { createHmac, timingSafeEqual } from "crypto";

/**
 * One-tap portal links for invitation emails.
 *
 * The access code is stored hashed, so it can't be read back to put in an
 * email. Instead every invitation email carries a personal link with a
 * signed token. The sub taps it and they're in — no typing a code on a
 * phone in a truck.
 *
 * The token is computed, not stored: it's an HMAC of the invitation id and
 * the sub's session epoch. That means:
 *   - nothing extra to keep in the database
 *   - regenerating a sub's access code bumps their epoch, which instantly
 *     kills every link in every email they were ever sent
 *   - a token for one invitation is useless for any other
 *
 * The 6-digit code still works for signing in by hand, and is still the
 * thing you read out over the phone.
 */

const secret = () => {
  const s = process.env.PORTAL_TOKEN_SECRET;
  if (!s) throw new Error("PORTAL_TOKEN_SECRET is not set");
  return s;
};

const sign = (invitationId: string, epoch: number) =>
  createHmac("sha256", secret())
    .update(`${invitationId}:${epoch}`)
    .digest("base64url");

export function makePortalToken(invitationId: string, epoch: number): string {
  return `${invitationId}.${sign(invitationId, epoch)}`;
}

export function readPortalToken(
  token: string
): { invitationId: string; signature: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  return {
    invitationId: token.slice(0, dot),
    signature: token.slice(dot + 1),
  };
}

export function verifyPortalToken(
  token: string,
  epoch: number
): string | null {
  const parts = readPortalToken(token);
  if (!parts) return null;

  const expected = sign(parts.invitationId, epoch);
  const a = Buffer.from(parts.signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return parts.invitationId;
}
