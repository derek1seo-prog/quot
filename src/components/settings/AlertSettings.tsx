"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BellRing, Check, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";

/** 설정 > 알림: which messenger channels the daily 컨테이너 현황 digest goes
 * to, and a test send. Channels are configured as server env vars. */
export function AlertSettings({ slackConnected }: { slackConnected: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendTest() {
    setState("sending");
    try {
      const res = await fetch("/api/containers/alerts/test", { method: "POST" });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3">
        <span className="w-9 h-9 rounded-full bg-[#4a154b]/10 text-[#4a154b] flex items-center justify-center shrink-0">
          <MessageSquare size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-[var(--foreground)]">Slack</p>
          <p className="text-[12px] text-[var(--muted)]">
            {slackConnected ? "매일 아침 8:30에 확인할 일을 보내요." : "Vercel 환경변수 SLACK_WEBHOOK_URL에 Incoming Webhook 주소를 넣으면 연결돼요."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
            slackConnected ? "bg-green-50 text-[var(--success)]" : "bg-[var(--sidebar-bg)] text-[var(--muted)]",
          )}
        >
          {slackConnected ? "연결됨" : "미연결"}
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-3">
        <span className="w-9 h-9 rounded-full bg-[#fee500]/40 text-[#3c1e1e] flex items-center justify-center shrink-0 font-bold text-[13px]">K</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-[var(--foreground)]">카카오톡 알림톡</p>
          <p className="text-[12px] text-[var(--muted)]">카카오 비즈니스 채널과 발송 대행사(예: 솔라피) 가입 후 연결할 수 있어요.</p>
        </div>
        <span className="rounded-full bg-[var(--sidebar-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--muted)] whitespace-nowrap">준비 중</span>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={sendTest}
          disabled={!slackConnected || state === "sending"}
          icon={state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        >
          테스트 알림 보내기
        </Button>
        {state === "sent" && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--success)]">
            <Check size={13} /> 보냈어요. 메신저를 확인해 보세요.
          </span>
        )}
        {state === "error" && <span className="text-[12.5px] text-[var(--danger)]">보내지 못했어요. Webhook 주소를 확인해 주세요.</span>}
      </div>
    </div>
  );
}
