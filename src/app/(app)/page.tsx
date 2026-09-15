import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentExchangeRate, getPorts, getQuotes } from "@/lib/data-store";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowUpRight, FilePlus2, Ship, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [quotes, exchangeRate] = await Promise.all([getQuotes(), getCurrentExchangeRate("USD")]);
  const ports = getPorts().filter((p) => p.role !== "DESTINATION");

  const now = new Date();
  const thisMonth = quotes.filter((q) => {
    const d = new Date(q.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const totalValue = quotes.reduce((sum, q) => sum + q.result.combinedGrandTotalKrw, 0);

  const stats = [
    {
      label: "전체 견적 수",
      value: `${quotes.length}건`,
      icon: <FilePlus2 size={18} />,
    },
    {
      label: "이번 달 견적",
      value: `${thisMonth.length}건`,
      icon: <TrendingUp size={18} />,
    },
    {
      label: "등록 출발항",
      value: `${ports.length}개`,
      icon: <Ship size={18} />,
    },
    {
      label: "적용 환율 (USD)",
      value: exchangeRate ? `₩${exchangeRate.rate.toLocaleString()}` : "미설정",
      icon: <Users size={18} />,
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">Dashboard</p>
          <h1 className="text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--foreground)]">
            중국발 수입 포워딩 견적
          </h1>
          <p className="text-[15px] text-[var(--muted)] mt-2 max-w-xl">
            출발지와 컨테이너 타입만 선택하면 운임과 부대비용이 자동으로 계산되어,
            바로 전달 가능한 견적서가 만들어집니다.
          </p>
        </div>
        <LinkButton href="/quotes/new" size="lg" icon={<FilePlus2 size={18} />}>
          새 견적 만들기
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-6">
              <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                {s.icon}
              </div>
            </div>
            <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
              {s.value}
            </p>
            <p className="text-[13px] text-[var(--muted)] mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
          최근 견적
        </h2>
        <Link
          href="/quotes"
          className="text-[13px] font-medium text-[var(--accent)] flex items-center gap-1 hover:underline"
        >
          전체 보기 <ArrowUpRight size={14} />
        </Link>
      </div>

      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium text-[var(--foreground)]">
              아직 생성된 견적이 없습니다.
            </p>
            <p className="text-[13px] text-[var(--muted)] mt-1 mb-6">
              첫 번째 견적을 만들어 보세요.
            </p>
            <LinkButton href="/quotes/new" icon={<FilePlus2 size={16} />} className="mx-auto">
              새 견적 만들기
            </LinkButton>
          </CardContent>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적번호</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">고객명</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">구간</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적일</th>
                <th className="px-6 py-3 font-medium text-right whitespace-nowrap">합계</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 6).map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="text-[13.5px] font-medium text-[var(--accent)] hover:underline"
                    >
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--foreground)] whitespace-nowrap">
                    {q.input.customerName}
                  </td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
                    <Badge tone="accent">{q.result.regionNameKo}</Badge>
                  </td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
                    {formatDate(q.input.quoteDate)}
                  </td>
                  <td className="px-6 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)] whitespace-nowrap">
                    {formatCurrency(q.result.combinedGrandTotalKrw, "KRW")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
            {quotes.slice(0, 6).map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="block px-6 py-4 active:bg-[var(--sidebar-bg)]/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-[var(--accent)]">
                    {q.quoteNumber}
                  </span>
                  <Badge tone="accent">{q.result.regionNameKo}</Badge>
                </div>
                <p className="text-[13.5px] text-[var(--foreground)] mt-1">{q.input.customerName}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] text-[var(--muted)]">
                    {formatDate(q.input.quoteDate)}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[var(--foreground)]">
                    {formatCurrency(q.result.combinedGrandTotalKrw, "KRW")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          </>
        )}
      </Card>

      {quotes.length > 0 && (
        <p className="text-[12px] text-[var(--muted)] mt-4">
          누적 견적 금액 합계: {formatCurrency(totalValue, "KRW")}
        </p>
      )}
    </div>
  );
}
