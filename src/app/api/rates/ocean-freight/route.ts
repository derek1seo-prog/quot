import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/id";
import { getOceanFreightRates, upsertOceanFreightRate } from "@/lib/data-store";
import type { OceanFreightRate } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getOceanFreightRates());
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<OceanFreightRate> & {
    portId: string;
    containerTypeId: string;
    rate: number;
  };
  const existing = (await getOceanFreightRates()).find(
    (r) => r.portId === body.portId && r.containerTypeId === body.containerTypeId,
  );
  const updated: OceanFreightRate = {
    id: existing?.id ?? generateId("of"),
    portId: body.portId,
    containerTypeId: body.containerTypeId,
    currency: body.currency ?? existing?.currency ?? "USD",
    rate: body.rate,
    effectiveFrom: body.effectiveFrom ?? existing?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
    effectiveTo: body.effectiveTo ?? existing?.effectiveTo ?? null,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await upsertOceanFreightRate(updated);
  return NextResponse.json(updated);
}
