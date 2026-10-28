import { NextRequest, NextResponse } from "next/server";
import { attentionDigest, attentionItems } from "@/lib/containers";
import { getContainers, getVesselWatches } from "@/lib/data-store";
import { kstToday } from "@/lib/exchange-rate-history";
import { alertChannels, sendAlert, siteUrl } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";

/** 설정 > 알림's "테스트 알림 보내기": today's digest (or a hello when
 * there's nothing to report) to every configured channel. */
export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  if (!alertChannels().slack) {
    return NextResponse.json({ ok: false, error: "연결된 알림 채널이 없어요." }, { status: 400 });
  }
  const [containers, vessels] = await Promise.all([getContainers(), getVesselWatches()]);
  const digest = attentionDigest(attentionItems(containers, vessels, kstToday()), siteUrl(req));
  const result = await sendAlert(
    `🔔 [테스트] I.S. Sea & Air 컨테이너 알림이 연결되었어요.\n${digest ?? "지금은 확인이 필요한 컨테이너가 없어요."}`,
  );
  return NextResponse.json({ ok: result.sent.length > 0, ...result }, { status: result.sent.length > 0 ? 200 : 502 });
}
