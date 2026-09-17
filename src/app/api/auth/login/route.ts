import { NextRequest, NextResponse } from "next/server";
import { getCustomerByLoginId } from "@/lib/data-store";
import { isHardcodedAdmin, verifyPassword } from "@/lib/auth/password";
import { newExpiry, sessionCookieOptions, signSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim();
  const password = body?.password;
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  try {
    if (isHardcodedAdmin(username, password)) {
      const token = await signSession({
        role: "admin",
        sub: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: newExpiry(),
      });
      const res = NextResponse.json({ role: "admin" });
      const { name, ...options } = sessionCookieOptions();
      res.cookies.set(name, token, options);
      return res;
    }

    const customer = await getCustomerByLoginId(username);
    if (customer?.passwordHash && verifyPassword(password, customer.passwordHash)) {
      const token = await signSession({
        role: "customer",
        sub: customer.id,
        customerName: customer.name,
        iat: Math.floor(Date.now() / 1000),
        exp: newExpiry(),
      });
      const res = NextResponse.json({ role: "customer" });
      const { name, ...options } = sessionCookieOptions();
      res.cookies.set(name, token, options);
      return res;
    }
  } catch (err) {
    // Almost always a missing/misconfigured AUTH_SECRET (signSession has
    // nothing to fall back to, unlike session reads) - surface this as a
    // distinct, recognizable error instead of an unhandled 500 that leaves
    // the login form with no feedback at all.
    console.error("[login] failed to sign session:", err);
    return NextResponse.json(
      { error: "서버 설정 오류로 로그인할 수 없습니다. 관리자에게 문의하세요." },
      { status: 500 },
    );
  }

  // Same generic message for "no such user" and "wrong password" - don't reveal which.
  return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
}
