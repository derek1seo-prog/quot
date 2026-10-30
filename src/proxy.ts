import { NextResponse, type NextRequest } from "next/server";
import { getCustomerByAccessToken } from "@/lib/data-store";
import { isClosedPath } from "@/lib/nav";
import { getSessionFromRequest, SESSION_EXPIRED_BODY, setSessionCookie, shouldRenewSession, type Role } from "@/lib/session";

/** Paths that render the quick-quote lookup experience with no PIN
 * required - "/" itself (the default homepage for anyone not logged in as
 * admin) and "/quick-quote" (the same experience, also reachable as its
 * own nav tab once logged in as admin). */
function isQuickQuotePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/quick-quote" || pathname.startsWith("/quick-quote/");
}

/** Paths any anonymous visitor may reach with no PIN and no customer
 * login at all - the quick-quote lookup experience, plus the read-only
 * rate overview ("/my/rates"), which was originally customer-portal-only
 * but is now opened up the same way quick-quote already is, since it's
 * the same kind of public reference material (registered base rates, no
 * customer-specific data). */
function isPublicPath(pathname: string): boolean {
  return isQuickQuotePath(pathname) || pathname === "/my/rates";
}

/** Coarse per-page allowlist for non-admin roles - default-deny, explicit-
 * allow (safer than trying to enumerate every admin-only page, which only
 * has to miss one new page to leak it). API routes are NOT gated here -
 * they get *some* session required (below) and then do their own precise
 * role check inside each handler, returning a proper JSON 403 instead of
 * an HTML redirect for a fetch() caller. */
function isAllowedForRole(pathname: string, role: Role): boolean {
  if (role === "admin") return true;
  if (role === "guest") return isPublicPath(pathname);
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

  // Paused pages (nav shows them greyed out): a typed / bookmarked URL
  // lands on the closest live page instead.
  if (isClosedPath(pathname)) {
    const to = session?.role === "customer" ? "/my" : session?.role === "admin" && pathname.startsWith("/vessels") ? "/containers" : "/";
    return NextResponse.redirect(new URL(to, request.url));
  }

  // "/", "/quick-quote", and "/my/rates" need no PIN at all - visiting any
  // of them for the first time silently issues a guest session and renders
  // directly (this is what used to be "게스트 모드로 입장하기" - a plain
  // link/visit, no separate API call).
  if (isPublicPath(pathname) && !session) {
    const res = NextResponse.next();
    setSessionCookie(res, { role: "guest" });
    return res;
  }

  // An expired / missing login: a fetch() caller gets JSON it can act on
  // (SessionGuard shows the inline re-login) instead of following a
  // redirect into the unlock page's HTML and failing to parse it.
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json(SESSION_EXPIRED_BODY, { status: 401 });
    return NextResponse.redirect(unlockUrl(request, pathname, search));
  }

  // Sliding expiry: keep an active session alive.
  const pass = () => {
    const res = NextResponse.next();
    if (shouldRenewSession(session)) setSessionCookie(res, { role: session.role, customerId: session.customerId });
    return res;
  };

  if (pathname.startsWith("/api/")) return pass();

  if (!isAllowedForRole(pathname, session.role)) {
    // A guest on an admin page is usually an admin whose login ran out
    // (visiting "/" quietly issued a guest session) - send them to log in
    // and come back, not to the guest home.
    if (session.role === "guest") return NextResponse.redirect(unlockUrl(request, pathname, search));
    return NextResponse.redirect(new URL("/my", request.url));
  }

  return pass();
}

/** /unlock?next=<this page>, without Next's own client-navigation params. */
function unlockUrl(request: NextRequest, pathname: string, search: string): URL {
  const url = new URL("/unlock", request.url);
  const params = new URLSearchParams(search);
  params.delete("_rsc");
  const query = params.toString();
  url.searchParams.set("next", pathname + (query ? `?${query}` : ""));
  return url;
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
