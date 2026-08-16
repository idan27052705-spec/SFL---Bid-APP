import {
  createHash,
  randomInt,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "crypto";

/**
 * Sub access codes.
 *
 * 6 digits, easy to read over the phone or text to a foreman.
 *
 * The code behaves like a password the office issues and can always tell a
 * sub, so it has to be recoverable. It is stored encrypted (AES-256-GCM)
 * rather than one-way hashed: the app can read it back to put in every
 * invitation email and to show on the sub's page.
 *
 * Honestly stated: a database leak alone does not expose codes — an attacker
 * also needs PORTAL_TOKEN_SECRET, which lives in the server environment and
 * never in the database. This is weaker than a one-way hash, and that is the
 * price of being able to tell a sub their own code.
 *
 * The salted hash is still stored alongside, so sign-in can be checked
 * without decrypting anything.
 *
 * A 6-digit code is only 1,000,000 possibilities, so brute force is stopped by
 * rate limiting on the portal login, not by the code's length. That limiter is
 * part of the portal build.
 */

const codeKey = () => {
  const secret = process.env.PORTAL_TOKEN_SECRET;
  if (!secret) throw new Error("PORTAL_TOKEN_SECRET is not set");
  // Derived, so there is no second secret to configure and rotate.
  return scryptSync(secret, "sfl-bid-desk/access-code", 32);
};

export function generateAccessCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Stored as iv.tag.ciphertext, all base64url. */
export function protectCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", codeKey(), iv);
  const out = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    out.toString("base64url"),
  ].join(".");
}

/** null for codes issued before this existed, or if the value was tampered with. */
export function revealCode(stored: string | null): string | null {
  if (!stored) return null;
  const [ivPart, tagPart, dataPart] = stored.split(".");
  if (!ivPart || !tagPart || !dataPart) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      codeKey(),
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
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

/** Everything needed to store a freshly issued code, in one place. */
export function issueAccessCode(subId: string) {
  const code = generateAccessCode();
  return {
    code,
    columns: {
      access_code_hash: hashAccessCode(code, subId),
      access_code_enc: protectCode(code),
      code_issued_at: new Date().toISOString(),
    },
  };
}
