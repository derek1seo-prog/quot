import { NextRequest, NextResponse } from "next/server";
import {
  isCorrectPassword,
  LOCK_COOKIE_MAX_AGE,
  LOCK_COOKIE_NAME,
  LOCK_COOKIE_VALUE,
} from "@/lib/site-lock";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isCorrectPassword(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCK_COOKIE_NAME, LOCK_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LOCK_COOKIE_MAX_AGE,
  });
  return res;
}
