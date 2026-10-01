import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/id";
import { getChargeRates, upsertChargeRate } from "@/lib/data-store";
import { todayIso } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { ChargeRate } from "@/lib/types";

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getChargeRates());
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as Partial<ChargeRate> & {
    regionId: string;
    chargeTypeId: string;
    containerTypeId: string;
    rate: number;
  };
  const existing = (await getChargeRates()).find(
    (r) =>
      r.regionId === body.regionId &&
      r.chargeTypeId === body.chargeTypeId &&
      r.containerTypeId === body.containerTypeId,
  );
  const updated: ChargeRate = {
    id: existing?.id ?? generateId("cr"),
    regionId: body.regionId,
    chargeTypeId: body.chargeTypeId,
    containerTypeId: body.containerTypeId,
    currency: body.currency ?? existing?.currency ?? "KRW",
    rate: body.rate,
    effectiveFrom: body.effectiveFrom ?? existing?.effectiveFrom ?? todayIso(),
    effectiveTo: body.effectiveTo ?? existing?.effectiveTo ?? null,
    updatedAt: todayIso(),
  };
  await upsertChargeRate(updated);
  return NextResponse.json(updated);
}
