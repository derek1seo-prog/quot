import { NextResponse, type NextRequest } from "next/server";
import { getCustomerByAccessToken } from "@/lib/data-store";
import { getSessionFromRequest, setSessionCookie, type Role } from "@/lib/session";

/** Paths that render the quick-quote lookup experience with no PIN
 * required - "/" itself (the default homepage for anyone not logged in as
 * admin) and "/quick-quote" (the same experience, also reachable as its
 * own nav tab once logged in as admin). */
function isQuickQuotePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/quick-quote" || pathname.startsWith("/quick-quote/");
}

/** Coarse per-page allowlist for non-admin roles - default-deny, explicit-
 * allow (safer than trying to enumerate every admin-only page, which only
 * has to miss one new page to leak it). API routes are NOT gated here -
 * they get *some* session required (below) and then do their own precise
 * role check inside each handler, returning a proper JSON 403 instead of
 * an HTML redirect for a fetch() caller. */
function isAllowedForRole(pathname: string, role: Role): boolean {
  if (role === "admin") return true;
  if (role === "guest") return isQuickQuotePath(pathname);
  // role === "customer" - /my (their own lookup + 내 견적) and any saved
  // quote under /quotes/:id (+ its /print sibling), but never the admin
  // quote list or wizard. Per-record ownership (this quote is actually
  // theirs) is checked at the page level, not here - see
  // src/app/(app)/quotes/[id]/page.tsx and src/app/quotes/[id]/print/page.tsx.
  if (pathname === "/my" || pathname.startsWith("/my/")) return true;
  if (pathname.startsWith("/quotes/") && !pathname.startsWith("/quotes/new")) return true;
  return false;
}

/** Site-wide access gate, now role-aware (admin / guest / customer) - see
 * src/lib/session.ts for the signed session cookie and src/lib/site-lock.ts
 * for the shared admin PIN. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // A customer's per-link entry point - validate the token against the
  // registered customers, issue a signed customer session on a match, and
  // redirect away. This path never actually renders a page.
  const tokenMatch = pathname.match(/^\/c\/([^/]+)$/);
  if (tokenMatch) {
    const customer = await getCustomerByAccessToken(tokenMatch[1]);
    const url = new URL(customer ? "/my" : "/unlock", request.url);
    const res = NextResponse.redirect(url);
    if (customer) setSessionCookie(res, { role: "customer", customerId: customer.id });
    return res;
  }

  const session = getSessionFromRequest(request);

  // "/" and "/quick-quote" need no PIN at all - visiting either for the
  // first time silently issues a guest session and renders directly (this
  // is what used to be "게스트 모드로 입장하기" - a plain link/visit, no
  // separate API call - now widened to be the site's default homepage
  // experience rather than a dedicated /guest path).
  if (isQuickQuotePath(pathname) && !session) {
    const res = NextResponse.next();
    setSessionCookie(res, { role: "guest" });
    return res;
  }

  if (!session) {
    const url = new URL("/unlock", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/api/")) return NextResponse.next();

  if (!isAllowedForRole(pathname, session.role)) {
    const home = session.role === "customer" ? "/my" : "/";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except: the unlock page/API itself, the cron endpoint
    // (hit directly by Vercel's scheduler, never through a browser with a
    // session cookie), Next's own static/image assets, and static files
    // served straight out of public/ (the unlock page's own logo included
    // - it must load unauthenticated or the lock screen itself can't
    // render its branding).
    "/((?!unlock|api/unlock|api/cron|_next/static|_next/image|.*\\.(?:svg|png|ico|jpg|jpeg|webp|gif|txt|xml|json|webmanifest)$).*)",
  ],
};
