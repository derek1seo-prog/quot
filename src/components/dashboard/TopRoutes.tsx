import { CountryFlag } from "@/components/ui/CountryFlag";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

export interface RouteStat {
  key: string;
  label: string;
  originCountryId: string;
  count: number;
  totalKrw: number;
  /** 견적 목록 pre-filtered to exactly this route and period. */
  href: string;
}

const compactKrw = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

/** Most-quoted routes as a ranked horizontal bar list (dashboard). Bar
 * length is the count relative to the top route - one hue, since it's a
 * magnitude; identity is the label, never the color. Each row links to the
 * matching filtered 견적 목록. */
export function TopRoutes({
  routes,
  periodTotal,
  routeCount,
}: {
  routes: RouteStat[];
  /** All quotes in the period (not just the top rows), for the footer/share. */
  periodTotal: number;
  routeCount: number;
}) {
  if (routes.length === 0) {
    return (
      <div className="h-[150px] flex items-center justify-center text-[13px] text-[var(--muted)]">
        최근 30일 견적이 없습니다.
      </div>
    );
  }

  const max = routes[0].count;

  return (
    <div>
      <ol className="-mx-2">
        {routes.map((r, i) => (
          <li key={r.key}>
            <Link
              href={r.href}
              title={`${r.label} · ${r.count}건 (${Math.round((r.count / periodTotal) * 100)}%) · 합계 ${formatCurrency(r.totalKrw, "KRW")}`}
              className="group block px-2 py-2 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--sidebar-bg)]"
            >
              <span className="flex items-center gap-2">
                <span className="w-3 shrink-0 text-[11.5px] font-medium text-[var(--muted)] tabular-nums">{i + 1}</span>
                <CountryFlag countryId={r.originCountryId} size={15} />
                <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                  {r.label}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-[var(--foreground)] tabular-nums">{r.count}건</span>
                <span className="shrink-0 w-[4.5rem] text-right text-[11.5px] text-[var(--muted)] tabular-nums">
                  ₩{compactKrw.format(r.totalKrw)}
                </span>
              </span>
              {/* Track starts under the route name (past rank + flag). */}
              <span className="block h-1.5 mt-1.5 ml-[2.75rem] rounded-full bg-[var(--sidebar-bg)] group-hover:bg-white overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[var(--accent)] animate-bar-grow-x"
                  style={{ width: `${(r.count / max) * 100}%`, animationDelay: `${380 + i * 60}ms` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11.5px] text-[var(--muted)]">
        최근 30일 {periodTotal}건 · {routeCount}개 구간
      </p>
    </div>
  );
}
