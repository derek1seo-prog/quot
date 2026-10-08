import { LinkButton } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { QuoteListView } from "@/components/quote/QuoteListView";
import { getPorts, getQuotes } from "@/lib/data-store";
import { parseQuoteListFilters, parseQuoteListPage } from "@/lib/quote-list-filters";
import { FilePlus2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuotesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialFilters = parseQuoteListFilters(params);
  const initialPage = parseQuoteListPage(params);
  const quotes = await getQuotes();
  const portNameById = Object.fromEntries(getPorts().map((p) => [p.id, p.nameKo]));

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="animate-dashboard-fade-up">
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">견적 관리</p>
          <h1 className="text-[28px] font-semibold tracking-tight">견적 목록</h1>
        </div>
        <LinkButton
          href="/quick-quote"
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
            <LinkButton href="/quick-quote" icon={<FilePlus2 size={16} />} className="mx-auto">
              새 견적 만들기
            </LinkButton>
          </CardContent>
        ) : (
          <QuoteListView
            quotes={quotes}
            portNameById={portNameById}
            initialFilters={initialFilters}
            initialPage={initialPage}
          />
        )}
      </Card>
    </div>
  );
}
