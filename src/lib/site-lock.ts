import { createHash } from "node:crypto";

/** Simple site-wide PIN gate (see src/proxy.ts + /unlock). Not meant to be
 * strong security - just keeps casual/unauthenticated visitors out. The PIN
 * is configurable via SITE_PASSWORD so it can be rotated without a code
 * change; defaults to the PIN the site owner asked for. */
export const SITE_PASSWORD = process.env.SITE_PASSWORD?.trim() || "1726";

export const LOCK_COOKIE_NAME = "site_unlocked";

// 30 days - long-lived on purpose so a returning visitor on the same
// device doesn't have to re-enter the PIN every session.
export const LOCK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// The cookie stores a hash of the password rather than the password
// itself, so it isn't sitting in plaintext in the browser's cookie jar.
export const LOCK_COOKIE_VALUE = createHash("sha256").update(SITE_PASSWORD).digest("hex");

export function isCorrectPassword(input: string): boolean {
  return input.trim() === SITE_PASSWORD;
}
