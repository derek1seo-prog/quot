import { NextRequest, NextResponse } from "next/server";
import { getCurrentExchangeRate, upsertExchangeRate } from "@/lib/data-store";

export async function GET() {
  return NextResponse.json(await getCurrentExchangeRate("USD"));
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { rate: number; asOf?: string };
  const updated = {
    id: "ex-usd",
    currency: "USD" as const,
    base: "KRW" as const,
    rate: body.rate,
    asOf: body.asOf ?? new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await upsertExchangeRate(updated);
  return NextResponse.json(updated);
}
