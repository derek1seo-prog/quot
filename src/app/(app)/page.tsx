import { Card, CardContent } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentExchangeRate, getPorts, getQuotes } from "@/lib/data-store";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowUpRight, DollarSign, ExternalLink, FilePlus2, Ship, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [quotes, exchangeRate] = await Promise.all([getQuotes(), getCurrentExchangeRate("USD")]);
  const allPorts = getPorts();
  const portNameById = new Map(allPorts.map((p) => [p.id, p.nameKo]));

  function routeLabel(originPortId: string, destinationPortId: string) {
    return `${portNameById.get(originPortId) ?? originPortId} → ${portNameById.get(destinationPortId) ?? destinationPortId}`;
  }

  const totalValue = quotes.reduce((sum, q) => sum + q.result.column.grandTotalKrw, 0);

  // Grouped rather than interleaved: the two data stats first, then the
  // two outbound quick links - stats/links reads as two clear halves
  // instead of alternating, and on the 2-column mobile grid it also means
  // each row is homogeneous (stat+stat, then link+link) instead of mixed.
  const dashboardCards: (
    | { kind: "stat"; label: string; value: string; sublabel?: string; icon: ReactNode }
    | { kind: "link"; label: string; sublabel: string; href: string; icon: ReactNode }
  )[] = [
    {
      kind: "stat",
      label: "전체 견적 수",
      value: `${quotes.length}건`,
      icon: <FilePlus2 size={18} />,
    },
    {
      kind: "stat",
      label: "환율 (USD)",
      value: exchangeRate ? `₩${exchangeRate.rate.toLocaleString()}` : "미설정",
      sublabel: exchangeRate ? `${formatDate(exchangeRate.asOf)} 기준` : undefined,
      icon: <DollarSign size={18} />,
    },
    {
      kind: "link",
      label: "선박 스케줄 조회",
      sublabel: "터미널별 입출항 일정",
      href: "https://www.tradlinx.com/ko/container-terminal-schedule",
      icon: <Ship size={18} />,
    },
    {
      kind: "link",
      label: "안전운임제 조회",
      sublabel: "화물자동차 안전운임 공지",
      href: "https://www.forwarder.kr/tariff/",
      icon: <ShieldCheck size={18} />,
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 lg:mb-14">
        <div>
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">Dashboard</p>
          <h1 className="text-[32px] lg:text-[36px] font-semibold tracking-tight text-[var(--foreground)]">
            수출입 포워딩 견적
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-10 lg:mb-14">
        {dashboardCards.map((c, i) =>
          c.kind === "stat" ? (
            <Card key={c.label} className="p-5">
              <div className="flex items-center justify-between mb-6">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  {c.icon}
                </div>
              </div>
              <p className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
                {c.value}
              </p>
              <p className="text-[13px] text-[var(--muted)] mt-0.5">{c.label}</p>
              {c.sublabel && (
                <p className="text-[12px] text-[var(--muted)]/70 mt-0.5">{c.sublabel}</p>
              )}
            </Card>
          ) : (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              // A seam between the stat and link groups so the grouping
              // reads as intentional, not just array order - only makes
              // sense on the desktop single-row (4-col) layout, where this
              // is the first link right after the last stat; on the
              // 2-column mobile grid it starts its own row already.
              className={i === 2 ? "lg:border-l lg:border-[var(--border-subtle)] lg:pl-4 xl:pl-5" : undefined}
            >
              <Card className="p-5 h-full transition-all duration-200 ease-out hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40 motion-reduce:transition-none">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                    {c.icon}
                  </div>
                  <ExternalLink size={14} className="text-[var(--muted)]" />
                </div>
                <p className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
                  {c.label}
                </p>
                <p className="text-[13px] text-[var(--muted)] mt-0.5">{c.sublabel}</p>
              </Card>
            </a>
          ),
        )}
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
                    {routeLabel(q.input.originPortId, q.input.destinationPortId)}
                  </td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
                    {formatDate(q.input.quoteDate)}
                  </td>
                  <td className="px-6 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)] whitespace-nowrap">
                    {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
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
                  <span className="text-[12px] text-[var(--muted)]">
                    {routeLabel(q.input.originPortId, q.input.destinationPortId)}
                  </span>
                </div>
                <p className="text-[13.5px] text-[var(--foreground)] mt-1">{q.input.customerName}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] text-[var(--muted)]">
                    {formatDate(q.input.quoteDate)}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[var(--foreground)]">
                    {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
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
