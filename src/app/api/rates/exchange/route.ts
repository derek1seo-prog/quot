import { NextRequest, NextResponse } from "next/server";
import { getCurrentExchangeRate, upsertExchangeRate } from "@/lib/data-store";
import { requireAdmin } from "@/lib/auth/require";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  return NextResponse.json(await getCurrentExchangeRate("USD"));
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

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
