import { InquiryInbox } from "@/components/inquiry/InquiryInbox";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "문의함 | I.S. Sea & Air" };

export default function InquiriesPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-14">
      <div className="mb-6 animate-dashboard-fade-up">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
        <h1 className="text-[28px] font-semibold tracking-tight">문의함</h1>
        <p className="text-[13px] text-[var(--muted)] mt-1">
          방문자와 화주가 우측 하단 상담 창으로 보낸 메시지입니다. 대화는 방문자(브라우저)별로 모입니다.
        </p>
      </div>
      <div className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <InquiryInbox />
      </div>
    </div>
  );
}
