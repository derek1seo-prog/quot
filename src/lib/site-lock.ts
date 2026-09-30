/** Shared admin password (see src/proxy.ts, /unlock, src/lib/session.ts).
 * Not meant to be strong security - just keeps casual/unauthenticated
 * visitors out. The password is configurable via SITE_PASSWORD so it can
 * be rotated without a code change; defaults to the password the site
 * owner asked for. */
export const SITE_PASSWORD = process.env.SITE_PASSWORD?.trim() || "isseaair";

export function isCorrectPassword(input: string): boolean {
  return input.trim() === SITE_PASSWORD;
}
