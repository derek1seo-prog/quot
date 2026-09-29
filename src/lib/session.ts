import { createHash, createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_PASSWORD } from "./site-lock";

/** Role-aware session, replacing the old boolean "unlocked or not" cookie.
 * - "admin": the forwarder/staff, unlocked via the shared PIN on /unlock -
 *   full access, exactly as before this feature.
 * - "guest": entered via "/" (or /quick-quote) with no PIN at all - can
 *   only reach the quick-quote lookup experience.
 * - "customer": entered via a per-customer link (/c/[token]) - can only
 *   reach /my and their own saved quotes. */
export type Role = "admin" | "guest" | "customer";

export interface Session {
  role: Role;
  customerId?: string;
}

export const SESSION_COOKIE_NAME = "quot_session";

// 1 day for every role, matching what the site owner asked for on the
// admin PIN - kept the same everywhere rather than inventing a separate
// policy per role.
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 1;

// Derived from SITE_PASSWORD rather than a separate env var, so rotating
// the site password also rotates the signing key (and invalidates every
// existing session) with no extra setup required - consistent with this
// app's low-friction "works with zero config beyond the PIN" philosophy.
const SIGNING_KEY = createHash("sha256").update(`${SITE_PASSWORD}:quot-session-v1`).digest();

function sign(payload: string): string {
  return createHmac("sha256", SIGNING_KEY).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify({ ...session, iat: Date.now() })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

/** Verifies the HMAC signature before trusting anything in the payload -
 * a session cookie is client-editable storage, so a guest/customer must
 * never be able to hand-edit their own cookie into role: "admin". */
export function decodeSession(cookieValue: string | undefined | null): Session | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  if (sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      role?: unknown;
      customerId?: unknown;
    };
    if (parsed.role !== "admin" && parsed.role !== "guest" && parsed.role !== "customer") {
      return null;
    }
    return {
      role: parsed.role,
      customerId: typeof parsed.customerId === "string" ? parsed.customerId : undefined,
    };
  } catch {
    return null;
  }
}

/** For proxy.ts and Route Handlers, which read cookies off a NextRequest. */
export function getSessionFromRequest(req: NextRequest): Session | null {
  return decodeSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/** For Server Components, which read cookies via next/headers. Takes the
 * already-awaited cookie store rather than importing next/headers itself,
 * so this module works the same in proxy.ts (no next/headers there). */
export function decodeSessionCookie(store: { get(name: string): { value: string } | undefined }): Session | null {
  return decodeSession(store.get(SESSION_COOKIE_NAME)?.value);
}

/** Guards an admin-only Route Handler. Returns a 403 JSON response to send
 * straight back when the caller isn't an admin (covers "URL을 직접 입력하거나
 * API를 호출하더라도 접근할 수 없도록" - proxy.ts only redirects page
 * navigations, so every admin-only API route calls this itself too), or
 * null when it's fine to continue. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const session = getSessionFromRequest(req);
  if (session?.role === "admin") return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function setSessionCookie(res: NextResponse, session: Session): void {
  res.cookies.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}
