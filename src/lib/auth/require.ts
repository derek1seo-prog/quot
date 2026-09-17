// Shared API-route guards - each returns the verified session payload on
// success, or a NextResponse(401) to return as-is on failure:
//   const session = await requireAdmin();
//   if (session instanceof NextResponse) return session;
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "./session";
import type { AdminSessionPayload, CustomerSessionPayload } from "./types";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

export async function requireAdmin(): Promise<AdminSessionPayload | NextResponse> {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function requireCustomer(): Promise<CustomerSessionPayload | NextResponse> {
  const session = await getSession();
  if (session?.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
