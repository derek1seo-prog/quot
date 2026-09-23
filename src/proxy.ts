import { NextResponse, type NextRequest } from "next/server";
import { LOCK_COOKIE_NAME, LOCK_COOKIE_VALUE } from "@/lib/site-lock";

/** Site-wide PIN gate - every page/API route not excluded by the matcher
 * below requires the LOCK_COOKIE_NAME cookie (set by POST /api/unlock after
 * a correct PIN) before it's served; otherwise it's redirected to /unlock.
 * See src/lib/site-lock.ts for the PIN itself and cookie details. */
export function proxy(request: NextRequest) {
  const unlocked = request.cookies.get(LOCK_COOKIE_NAME)?.value === LOCK_COOKIE_VALUE;
  if (unlocked) return NextResponse.next();

  const url = new URL("/unlock", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except: the unlock page/API itself, the cron endpoint
    // (hit directly by Vercel's scheduler, never through a browser with
    // the unlock cookie), Next's own static/image assets, and static
    // files served straight out of public/ (the unlock page's own logo
    // included - it must load unauthenticated or the lock screen itself
    // can't render its branding).
    "/((?!unlock|api/unlock|api/cron|_next/static|_next/image|.*\\.(?:svg|png|ico|jpg|jpeg|webp|gif|txt|xml|json|webmanifest)$).*)",
  ],
};
