import { NextRequest, NextResponse } from "next/server";
import { attentionDigest, attentionItems } from "@/lib/containers";
import { getContainerAlertState, getContainers, getVesselWatches, saveContainerAlertState } from "@/lib/data-store";
import { kstToday } from "@/lib/exchange-rate-history";
import { sendAlert, siteUrl } from "@/lib/notify";

/**
 * Daily 08:30 KST digest of 컨테이너 현황 items that need action (출항 확인,
 * 배차 필요, 프리타임, 서렌더) to the messenger channels in src/lib/notify.ts.
 * Scheduled in vercel.json; gated on CRON_SECRET the same way as the
 * exchange-rate cron. Sends nothing on a day with nothing to report, and at
 * most one digest per KST day however often the route is hit.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = kstToday();
  const [containers, vessels, state] = await Promise.all([getContainers(), getVesselWatches(), getContainerAlertState()]);
  if (state.lastSentDay === today) return NextResponse.json({ ok: true, skipped: "already sent today" });
  const items = attentionItems(containers, vessels, today);
  const digest = attentionDigest(items, siteUrl(req));
  if (!digest) return NextResponse.json({ ok: true, items: 0, sent: [] });
  const result = await sendAlert(digest);
  if (result.sent.length > 0) await saveContainerAlertState({ lastSentDay: today });
  return NextResponse.json({ ok: result.failed.length === 0, items: items.length, ...result });
}
