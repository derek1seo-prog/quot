import { LinkButton } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { QuoteListCard } from "@/components/quote/QuoteListCard";
import { QuoteListRow } from "@/components/quote/QuoteListRow";
import { getPorts, getQuotes, getRegions } from "@/lib/data-store";
import { FilePlus2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  const quotes = await getQuotes();
  const portNameById = Object.fromEntries(getPorts().map((p) => [p.id, p.nameKo]));
  const regionCountryById = Object.fromEntries(getRegions().map((r) => [r.id, r.countryId]));

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="animate-dashboard-fade-up">
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">견적 관리</p>
          <h1 className="text-[28px] font-semibold tracking-tight">견적 목록</h1>
        </div>
        <LinkButton
          href="/quotes/new"
          icon={<FilePlus2 size={16} />}
          className="animate-dashboard-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          새 견적 만들기
        </LinkButton>
      </div>

      <Card className="overflow-hidden animate-dashboard-fade-up" style={{ animationDelay: "160ms" }}>
        {quotes.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium">아직 생성된 견적이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1 mb-6">첫 번째 견적을 만들어 보세요.</p>
            <LinkButton href="/quotes/new" icon={<FilePlus2 size={16} />} className="mx-auto">
              새 견적 만들기
            </LinkButton>
          </CardContent>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left min-w-[840px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적번호</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">고객명</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">구간</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">인코텀즈</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">권역</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적일</th>
                <th className="px-6 py-3 font-medium text-right whitespace-nowrap">합계</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => (
                <QuoteListRow
                  key={q.id}
                  quote={q}
                  portNameById={portNameById}
                  regionCountryById={regionCountryById}
                  // Capped so a long list still settles quickly instead of
                  // trickling in row by row for several seconds - only the
                  // first screenful visibly cascades.
                  animationDelayMs={220 + Math.min(i, 10) * 30}
                />
              ))}
            </tbody>
          </table>
          </div>

          <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
            {quotes.map((q, i) => (
              <QuoteListCard
                key={q.id}
                quote={q}
                portNameById={portNameById}
                regionCountryById={regionCountryById}
                animationDelayMs={220 + Math.min(i, 10) * 30}
              />
            ))}
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
