import { NextRequest, NextResponse } from "next/server";
import { attentionItems } from "@/lib/containers";
import { getContainers, getVesselWatches } from "@/lib/data-store";
import { kstToday } from "@/lib/exchange-rate-history";
import { requireAdmin } from "@/lib/session";

/** The nav badge's count of 컨테이너 현황 items that need someone to act. */
export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const [containers, vessels] = await Promise.all([getContainers(), getVesselWatches()]);
  return NextResponse.json({ count: attentionItems(containers, vessels, kstToday()).length });
}
