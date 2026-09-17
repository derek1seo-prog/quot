import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/login"],
};

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    if (session?.role === "admin") return NextResponse.redirect(new URL("/admin", req.url));
    if (session?.role === "customer") return NextResponse.redirect(new URL("/portal", req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/portal") && session?.role !== "customer") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
