import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { QuoteTrendSparkline } from "@/components/dashboard/QuoteTrendSparkline";
import { ExchangeRateEditor } from "@/components/rates/ExchangeRateEditor";
import { getCompany, getCurrentExchangeRate } from "@/lib/data-store";
import { EXCHANGE_TREND_DAYS, getUsdKrwTrend } from "@/lib/exchange-rate-history";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = getCompany();
  const [exchangeRate, trend] = await Promise.all([getCurrentExchangeRate("USD"), getUsdKrwTrend()]);
  const trendLast = trend[trend.length - 1];
  const hasEcbBackfill = trend.some((t) => t.source === "ecb");
  // Week-over-week change: compare against the latest recorded day on or
  // before 7 days ago (weekends/gaps fall back to the closest earlier day,
  // else the oldest point in the chart).
  const DAY = 86_400_000;
  const weekAgo = trendLast ? new Date(Date.parse(trendLast.date) - 7 * DAY).toISOString().slice(0, 10) : "";
  const trendBase =
    trend.length >= 2 ? ([...trend].reverse().find((t) => t.date <= weekAgo) ?? trend[0]) : undefined;
  const trendChange = trendBase ? trendLast.rate - trendBase.rate : 0;
  const baseDays = trendBase ? Math.round((Date.parse(trendLast.date) - Date.parse(trendBase.date)) / DAY) : 0;
  const trendSpanLabel =
    baseDays >= 6 && baseDays <= 9 ? "1주 전" : baseDays >= 13 ? "2주 전" : baseDays === 1 ? "어제" : `${baseDays}일 전`;

  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16 space-y-8">
      <div className="animate-dashboard-fade-up">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">설정</p>
        <h1 className="text-[28px] font-semibold tracking-tight">설정</h1>
      </div>

      <Card className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>환율</CardTitle>
          <CardDescription>
            견적 계산에 사용되는 기준 환율입니다. 모든 USD 항목은 이 환율로 원화 환산됩니다.
            매일 아침 자동으로 최신 시장 환율로 갱신되며, 필요 시 아래에서 직접 수정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exchangeRate ? (
            <ExchangeRateEditor initial={exchangeRate} />
          ) : (
            <p className="text-[13px] text-[var(--muted)]">환율이 설정되어 있지 않습니다.</p>
          )}

          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <p className="text-[13px] font-medium text-[var(--muted)]">
                최근 {EXCHANGE_TREND_DAYS}일 환율 추이
              </p>
              {trendBase && (
                <p className="text-[12px] text-[var(--muted)]" title={`${trendBase.date.slice(5).replace("-", "/")} 대비`}>
                  {trendSpanLabel} 대비{" "}
                  <span
                    className={
                      trendChange > 0
                        ? "font-medium text-[var(--danger)]"
                        : trendChange < 0
                          ? "font-medium text-[var(--accent)]"
                          : "font-medium text-[var(--foreground)]"
                    }
                  >
                    {trendChange > 0 ? "▲" : trendChange < 0 ? "▼" : ""}
                    {Math.abs(trendChange).toLocaleString("ko-KR")}원
                  </span>
                </p>
              )}
            </div>
            {trend.length >= 2 ? (
              <>
                <QuoteTrendSparkline
                  unit="krw"
                  data={trend.map((t) => ({ date: t.date, count: t.rate }))}
                />
                {hasEcbBackfill && (
                  <p className="text-[11.5px] text-[var(--muted)] mt-3">
                    기록이 시작되기 전 날짜는 ECB 기준 환율로 채워져 있습니다.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[var(--muted)]">
                매일 아침 갱신되는 환율이 쌓이면 추이 그래프가 표시됩니다.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="animate-dashboard-fade-up" style={{ animationDelay: "140ms" }}>
        <CardHeader>
          <CardTitle>회사 정보</CardTitle>
          <CardDescription>견적서 상단에 표시되는 발신 회사 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid sm:grid-cols-2 gap-4 text-[13.5px]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">회사명</dt>
              <dd className="mt-0.5 font-medium">{company.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">전화 / 팩스</dt>
              <dd className="mt-0.5">
                {company.tel} {company.fax ? `/ ${company.fax}` : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">주소</dt>
              <dd className="mt-0.5">{company.addressLines.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">웹사이트</dt>
              <dd className="mt-0.5">{company.website}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-[var(--muted)] mt-4">
            회사 정보 수정 기능은 다음 버전에서 지원될 예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
