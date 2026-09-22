import { upsertExchangeRate } from "@/lib/data-store";
import { NextRequest, NextResponse } from "next/server";

// Free, no-API-key market exchange rate service - updated daily.
const EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/USD";

/**
 * Refreshes the USD -> KRW rate every morning via Vercel Cron (see
 * vercel.json). Optionally auth-gated on CRON_SECRET - Vercel attaches this
 * as the Authorization header automatically when the env var is configured,
 * so this route only accepts the scheduled job's own requests. Setting
 * CRON_SECRET is not required for the cron to work: without it the route is
 * open (this endpoint just refreshes a public market rate, no user data),
 * so the schedule in vercel.json runs out of the box with no Vercel env
 * setup needed.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let krwRate: unknown;
  try {
    const res = await fetch(EXCHANGE_RATE_API_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, unknown> };
    krwRate = data.rates?.KRW;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch exchange rate";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  if (typeof krwRate !== "number" || !Number.isFinite(krwRate) || krwRate <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid KRW rate from upstream" }, { status: 502 });
  }

  const rate = Math.round(krwRate);
  // The cron fires at 23:00 UTC = 08:00 KST the *next* day, so the UTC
  // calendar date (what toISOString() would give) is always one day
  // behind the Korean morning this actually runs on. Stamp the KST date
  // instead, so 기준일/마지막 업데이트 read as "today" to a Korean user.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const updated = {
    id: "ex-usd",
    currency: "USD" as const,
    base: "KRW" as const,
    rate,
    asOf: today,
    updatedAt: today,
  };
  await upsertExchangeRate(updated);

  return NextResponse.json({ ok: true, rate, asOf: updated.asOf });
}
