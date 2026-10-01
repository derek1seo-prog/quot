import { NextRequest, NextResponse } from "next/server";
import { getCurrentExchangeRate, upsertExchangeRate } from "@/lib/data-store";
import { todayIso } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getCurrentExchangeRate("USD"));
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { rate: number; asOf?: string };
  const updated = {
    id: "ex-usd",
    currency: "USD" as const,
    base: "KRW" as const,
    rate: body.rate,
    asOf: body.asOf ?? todayIso(),
    updatedAt: new Date().toISOString(),
  };
  await upsertExchangeRate(updated);
  return NextResponse.json(updated);
}
