import { LinkButton } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { QuoteListRow } from "@/components/quote/QuoteListRow";
import { getQuotes } from "@/lib/data-store";
import { FilePlus2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function QuotesListPage() {
  const quotes = getQuotes();

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">견적 관리</p>
          <h1 className="text-[28px] font-semibold tracking-tight">견적 목록</h1>
        </div>
        <LinkButton href="/quotes/new" icon={<FilePlus2 size={16} />}>
          새 견적 만들기
        </LinkButton>
      </div>

      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium">아직 생성된 견적이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1 mb-6">첫 번째 견적을 만들어 보세요.</p>
            <LinkButton href="/quotes/new" icon={<FilePlus2 size={16} />} className="mx-auto">
              새 견적 만들기
            </LinkButton>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적번호</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">고객명</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">구간</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">권역</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적일</th>
                <th className="px-6 py-3 font-medium text-right whitespace-nowrap">합계</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <QuoteListRow key={q.id} quote={q} />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
