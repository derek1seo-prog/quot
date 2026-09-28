import { NextRequest, NextResponse } from "next/server";
import { isCorrectPassword } from "@/lib/site-lock";
import { setSessionCookie } from "@/lib/session";
import { checkLoginLimit, getClientIp, recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const limit = await checkLoginLimit(ip);
  if (limit.locked) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isCorrectPassword(password)) {
    const result = await recordLoginFailure(ip);
    if (result.locked) {
      return NextResponse.json(
        { ok: false, reason: "rate_limited", retryAfterSec: result.retryAfterSec },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: false, reason: "wrong_password" }, { status: 401 });
  }

  await recordLoginSuccess(ip);

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, { role: "admin" });
  return res;
}
