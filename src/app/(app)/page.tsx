import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { CardBackdropTrend } from "@/components/dashboard/CardBackdropTrend";
import { CountUpStat } from "@/components/dashboard/CountUpStat";
import { QuoteTrendBars } from "@/components/dashboard/QuoteTrendBars";
import type { TrendPoint } from "@/components/dashboard/QuoteTrendSparkline";
import { TopRoutes, type RouteStat } from "@/components/dashboard/TopRoutes";
import { QuickQuoteScreen } from "@/components/quote/QuickQuoteScreen";
import { getCurrentExchangeRate, getPorts, getQuotes, getVesselWatches } from "@/lib/data-store";
import { isDelayed } from "@/lib/vessels";
import { getUsdKrwTrend, kstToday, rateChange, shiftIsoDate, shortDate } from "@/lib/exchange-rate-history";
import { formatCurrency, formatDate, pairLabel, pairTotalsTitle } from "@/lib/format";
import { decodeSessionCookie } from "@/lib/session";
import { ArrowUpRight, DollarSign, ExternalLink, FilePlus2, Ship, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = decodeSessionCookie(await cookies());
  if (session?.role !== "admin") {
    return <QuickQuoteScreen isAdmin={false} />;
  }

  const [quotes, exchangeRate, usdTrend, vesselWatches] = await Promise.all([
    getQuotes(),
    getCurrentExchangeRate("USD"),
    getUsdKrwTrend(),
    getVesselWatches(),
  ]);
  const trackedVessels = vesselWatches.filter((w) => w.status === "active");
  const delayedVessels = trackedVessels.filter(isDelayed).length;
  const allPorts = getPorts();
  const portNameById = new Map(allPorts.map((p) => [p.id, p.nameKo]));

  function routeLabel(originPortId: string, destinationPortId: string) {
    return `${portNameById.get(originPortId) ?? originPortId} → ${portNameById.get(destinationPortId) ?? destinationPortId}`;
  }

  // 20FT+40HQ quotes carry two totals - neither alone is "the" amount, so
  // money sums leave them out (they still count as quotes).
  const totalValue = quotes.reduce((sum, q) => sum + (q.pairedResult ? 0 : q.result.column.grandTotalKrw), 0);

  // 최근 견적 추이: real activity (createdAt), not the user-editable
  // quoteDate field - zero-filled so gaps show as a real flat stretch
  // rather than being silently skipped. Twice the shown span is built so
  // the chart can compare against the 14 days before it.
  const TREND_DAYS = 14;
  const trendSpan: TrendPoint[] = Array.from({ length: TREND_DAYS * 2 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (TREND_DAYS * 2 - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    const count = quotes.filter((q) => q.createdAt.slice(0, 10) === iso).length;
    return { date: iso, count };
  });
  const trendData = trendSpan.slice(TREND_DAYS);
  const trendPreviousTotal = trendSpan.slice(0, TREND_DAYS).reduce((sum, d) => sum + d.count, 0);

  // 많이 견적한 구간: by 견적일 over the last 30 days, so each row's link
  // (search "출발 도착" + from=) opens a 견적 목록 showing exactly the
  // quotes counted here - the list's search text ends "...출발 도착".
  const routeFrom = shiftIsoDate(kstToday(), -29);
  const periodQuotes = quotes.filter((q) => q.input.quoteDate.slice(0, 10) >= routeFrom);
  const routeMap = new Map<string, RouteStat>();
  for (const q of periodQuotes) {
    const { originPortId, destinationPortId, originCountryId } = q.input;
    const key = `${originPortId}>${destinationPortId}`;
    const existing = routeMap.get(key);
    if (existing) {
      existing.count += 1;
      if (!q.pairedResult) existing.totalKrw += q.result.column.grandTotalKrw;
      continue;
    }
    const origin = portNameById.get(originPortId) ?? originPortId;
    const destination = portNameById.get(destinationPortId) ?? destinationPortId;
    routeMap.set(key, {
      key,
      label: `${origin} → ${destination}`,
      originCountryId,
      count: 1,
      totalKrw: q.pairedResult ? 0 : q.result.column.grandTotalKrw,
      href: `/quotes?${new URLSearchParams({ q: `${origin} ${destination}`, from: routeFrom })}`,
    });
  }
  const topRoutes = [...routeMap.values()]
    .sort((a, b) => b.count - a.count || b.totalKrw - a.totalKrw)
    .slice(0, 5);

  // Last 7 days, drawn faintly behind the two stat cards.
  const quotesWeek = trendData.slice(-7).map((d) => d.count);
  const quotesWeekTotal = quotesWeek.reduce((sum, n) => sum + n, 0);
  // The right-hand 7 days of the same series 설정 charts, and the change is
  // measured across exactly the points drawn - so both pages agree.
  const usdLast = usdTrend[usdTrend.length - 1];
  const usdWeekPoints = usdLast ? usdTrend.filter((t) => t.date >= shiftIsoDate(usdLast.date, -6)) : [];
  const usdWeek = usdWeekPoints.map((t) => t.rate);
  const usdWeekDelta = rateChange(usdWeekPoints);

  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  // Grouped rather than interleaved: the two data stats first, then the
  // two outbound quick links - stats/links reads as two clear halves
  // instead of alternating, and on the 2-column mobile grid it also means
  // each row is homogeneous (stat+stat, then link+link) instead of mixed.
  const dashboardCards: (
    | {
        kind: "stat";
        label: string;
        value: string;
        countUp?: { value: number; prefix?: string; suffix?: string };
        sublabel?: string;
        icon: ReactNode;
        trend?: number[];
        chip?: { text: string; tone: "up" | "down" | "neutral"; title?: string };
        href: string;
      }
    | { kind: "link"; label: string; sublabel: string; href: string; icon: ReactNode; internal?: boolean }
  )[] = [
    {
      kind: "stat",
      label: "전체 견적 수",
      value: `${quotes.length}건`,
      countUp: { value: quotes.length, suffix: "건" },
      icon: <FilePlus2 size={18} />,
      trend: quotesWeek,
      chip: { text: `최근 7일 ${quotesWeekTotal}건`, tone: "neutral" },
      href: "/quotes",
    },
    {
      kind: "stat",
      label: "환율 (USD)",
      value: exchangeRate ? `₩${exchangeRate.rate.toLocaleString()}` : "미설정",
      countUp: exchangeRate ? { value: exchangeRate.rate, prefix: "₩" } : undefined,
      sublabel: exchangeRate ? `${formatDate(exchangeRate.asOf)} 기준` : undefined,
      icon: <DollarSign size={18} />,
      trend: usdWeek,
      chip: usdWeekDelta
        ? {
            text: `7일 ${usdWeekDelta.change > 0 ? "▲" : usdWeekDelta.change < 0 ? "▼" : ""}${Math.abs(usdWeekDelta.change).toLocaleString("ko-KR")}원`,
            tone: usdWeekDelta.change > 0 ? "up" : usdWeekDelta.change < 0 ? "down" : "neutral",
            title: `${shortDate(usdWeekDelta.first.date)} ₩${usdWeekDelta.first.rate.toLocaleString("ko-KR")} → ${shortDate(usdWeekDelta.last.date)} ₩${usdWeekDelta.last.rate.toLocaleString("ko-KR")}`,
          }
        : undefined,
      href: "/settings",
    },
    {
      kind: "link",
      label: "선박 스케줄",
      sublabel:
        trackedVessels.length > 0
          ? `추적 중 ${trackedVessels.length}척${delayedVessels > 0 ? ` · 지연 ${delayedVessels}척` : ""}`
          : "입·출항일 변경 추적",
      href: "/vessels",
      icon: <Ship size={18} />,
      internal: true,
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
    <div className="max-w-[1200px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 lg:mb-14">
        <div className="animate-dashboard-fade-up">
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">
            Dashboard <span className="text-[var(--muted)] font-normal">· {todayLabel}</span>
          </p>
          <h1 className="text-[32px] lg:text-[36px] font-semibold tracking-tight text-[var(--foreground)]">
            수출입 포워딩 견적
          </h1>
          <p className="text-[15px] text-[var(--muted)] mt-2 max-w-xl">
            출발지와 컨테이너 타입만 선택하면 운임과 부대비용이 자동으로 계산되어,
            바로 전달 가능한 견적서가 만들어집니다.
          </p>
        </div>
        <div className="flex gap-2 animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="relative">
            <LinkButton href="/quick-quote" size="lg" icon={<Zap size={18} />}>
              빠른 견적 만들기
            </LinkButton>
            <Badge tone="accent" className="absolute -top-2 -right-2 shadow-sm">
              신버전
            </Badge>
          </div>
          <LinkButton href="/quotes/new" variant="secondary" size="lg" icon={<FilePlus2 size={18} />}>
            새 견적 만들기
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-10 lg:mb-14">
        {dashboardCards.map((c, i) =>
          c.kind === "stat" ? (
            <Link
              key={c.label}
              href={c.href}
              className="animate-dashboard-fade-up"
              style={{ animationDelay: `${140 + i * 50}ms` }}
            >
              <Card className="relative overflow-hidden p-5 h-full transition-all duration-200 ease-out hover:border-[var(--accent)]/50 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {c.trend && <CardBackdropTrend values={c.trend} />}
                <div className="relative">
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                      {c.icon}
                    </div>
                    {c.chip && (
                      <span
                        title={c.chip.title}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
                          c.chip.tone === "up" && "bg-[var(--danger)]/[0.08] text-[var(--danger)]",
                          c.chip.tone === "down" && "bg-[var(--accent-soft)] text-[var(--accent)]",
                          c.chip.tone === "neutral" && "bg-[var(--sidebar-bg)] text-[var(--muted)]",
                        )}
                      >
                        {c.chip.text}
                      </span>
                    )}
                  </div>
                  <p className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
                    {c.countUp ? (
                      <CountUpStat value={c.countUp.value} prefix={c.countUp.prefix} suffix={c.countUp.suffix} />
                    ) : (
                      c.value
                    )}
                  </p>
                  <p className="text-[13px] text-[var(--muted)] mt-0.5">{c.label}</p>
                  {c.sublabel && (
                    <p className="text-[12px] text-[var(--muted)]/70 mt-0.5">{c.sublabel}</p>
                  )}
                </div>
              </Card>
            </Link>
          ) : (
            <a
              key={c.label}
              href={c.href}
              {...(c.internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              // A seam between the stat and link groups so the grouping
              // reads as intentional, not just array order - only makes
              // sense on the wide single-row (4-col) layout, where this
              // is the first link right after the last stat; on the
              // 2-column grid (phones, tablets) it starts its own row.
              className={`animate-dashboard-fade-up ${i === 2 ? "xl:border-l xl:border-[var(--border-subtle)] xl:pl-5" : ""}`}
              style={{ animationDelay: `${140 + i * 50}ms` }}
            >
              <Card className="p-5 h-full transition-all duration-200 ease-out hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                    {c.icon}
                  </div>
                  {c.internal ? (
                    <ArrowUpRight size={14} className="text-[var(--muted)]" />
                  ) : (
                    <ExternalLink size={14} className="text-[var(--muted)]" />
                  )}
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

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-5 mb-10 lg:mb-14">
        <Card className="p-5 flex flex-col animate-dashboard-fade-up" style={{ animationDelay: "300ms" }}>
          <p className="text-[13px] font-medium text-[var(--muted)] mb-3">
            견적 추이 <span className="font-normal">· 최근 14일</span>
          </p>
          <QuoteTrendBars data={trendData} previousTotal={trendPreviousTotal} />
        </Card>
        <Card className="p-5 animate-dashboard-fade-up" style={{ animationDelay: "330ms" }}>
          <p className="text-[13px] font-medium text-[var(--muted)] mb-3">
            많이 견적한 구간 <span className="font-normal">· 최근 30일</span>
          </p>
          <TopRoutes routes={topRoutes} periodTotal={periodQuotes.length} routeCount={routeMap.size} />
        </Card>
      </div>

      <div
        className="flex items-center justify-between mb-4 animate-dashboard-fade-up"
        style={{ animationDelay: "340ms" }}
      >
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

      <Card className="overflow-hidden animate-dashboard-fade-up" style={{ animationDelay: "380ms" }}>
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
                <th className="px-6 py-3 font-medium whitespace-nowrap">인코텀즈</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">견적일</th>
                <th className="px-6 py-3 font-medium text-right whitespace-nowrap">합계</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 6).map((q, i) => (
                <tr
                  key={q.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors animate-dashboard-fade-up"
                  style={{ animationDelay: `${420 + i * 35}ms` }}
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
                    {q.input.incoterms}
                  </td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
                    {formatDate(q.input.quoteDate)}
                  </td>
                  <td
                    className="px-6 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)] whitespace-nowrap"
                    title={pairTotalsTitle(q)}
                  >
                    {pairLabel(q) ? (
                      <span className="font-normal text-[var(--muted)]">{pairLabel(q)}</span>
                    ) : (
                      formatCurrency(q.result.column.grandTotalKrw, "KRW")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
            {quotes.slice(0, 6).map((q, i) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="block px-6 py-4 active:bg-[var(--sidebar-bg)]/50 animate-dashboard-fade-up"
                style={{ animationDelay: `${420 + i * 35}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-[var(--accent)]">
                    {q.quoteNumber}
                  </span>
                  <span className="text-[12px] text-[var(--muted)]">
                    {routeLabel(q.input.originPortId, q.input.destinationPortId)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[13.5px] text-[var(--foreground)]">{q.input.customerName}</p>
                  <Badge tone="neutral">{q.input.incoterms}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] text-[var(--muted)]">
                    {formatDate(q.input.quoteDate)}
                  </span>
                  {pairLabel(q) ? (
                    <span className="text-[12.5px] text-[var(--muted)]">{pairLabel(q)}</span>
                  ) : (
                    <span className="text-[13.5px] font-semibold text-[var(--foreground)]">
                      {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
                    </span>
                  )}
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
