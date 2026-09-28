/** Shared admin PIN (see src/proxy.ts, /unlock, src/lib/session.ts). Not
 * meant to be strong security - just keeps casual/unauthenticated visitors
 * out. The PIN is configurable via SITE_PASSWORD so it can be rotated
 * without a code change; defaults to the PIN the site owner asked for. */
export const SITE_PASSWORD = process.env.SITE_PASSWORD?.trim() || "1726";

export function isCorrectPassword(input: string): boolean {
  return input.trim() === SITE_PASSWORD;
}
