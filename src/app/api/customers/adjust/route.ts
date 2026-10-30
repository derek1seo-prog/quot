import { NextRequest, NextResponse } from "next/server";
import { getCustomerRateAdjustment, getCustomers, saveCustomerRateAdjustment, saveCustomers } from "@/lib/data-store";
import { requireAdmin } from "@/lib/session";
import {
  adjustAmount,
  isValidPercent,
  ROUND_UNITS,
  TRUCKING_FIELDS,
  type CustomerRateAdjustment,
  type RoundUnit,
} from "@/lib/trucking-adjust";

/** The last 안전운임 % 조정 (for the dialog's 되돌리기). */
export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const last = await getCustomerRateAdjustment();
  return NextResponse.json(last.at ? { percent: last.percent, unit: last.unit, at: last.at } : null);
}

/** Moves every 화주's 운송료 and 안전운임 by `percent`, rounded to `unit`,
 * keeping the previous values so the change can be undone exactly. */
export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const body = ((await req.json().catch(() => null)) ?? {}) as { percent?: unknown; unit?: unknown };
  const percent = Number(body.percent);
  const unit = (ROUND_UNITS as readonly number[]).includes(Number(body.unit)) ? (Number(body.unit) as RoundUnit) : 100;
  if (!isValidPercent(percent)) {
    return NextResponse.json({ error: "-50% ~ +50% 사이로 입력해 주세요." }, { status: 400 });
  }

  const customers = await getCustomers();
  const previous: NonNullable<CustomerRateAdjustment["previous"]> = {};
  const updated = customers.map((c) => {
    const next = { ...c };
    for (const field of TRUCKING_FIELDS) {
      const from = c[field];
      if (typeof from !== "number" || !Number.isFinite(from)) continue;
      const to = adjustAmount(from, percent, unit);
      if (to === from) continue;
      (previous[c.id] ??= {})[field] = from;
      next[field] = to;
    }
    return next;
  });
  await saveCustomers(updated);
  const at = new Date().toISOString();
  await saveCustomerRateAdjustment({ percent, unit, at, previous });
  return NextResponse.json({ customers: updated, adjustment: { percent, unit, at } });
}

/** 되돌리기: puts back the values the last adjustment replaced. */
export async function DELETE(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const last = await getCustomerRateAdjustment();
  if (!last.at || !last.previous) return NextResponse.json({ error: "되돌릴 조정이 없어요." }, { status: 404 });
  const customers = await getCustomers();
  const restored = customers.map((c) => {
    const prev = last.previous?.[c.id];
    return prev ? { ...c, ...prev } : c;
  });
  await saveCustomers(restored);
  await saveCustomerRateAdjustment({});
  return NextResponse.json({ customers: restored });
}
