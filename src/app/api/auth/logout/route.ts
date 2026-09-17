import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const { name, ...options } = sessionCookieOptions();
  res.cookies.set(name, "", { ...options, maxAge: 0 });
  return res;
}
