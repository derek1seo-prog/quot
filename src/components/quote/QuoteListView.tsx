"use client";

import { Button } from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import { FilterCombobox } from "@/components/ui/FilterCombobox";
import { Input } from "@/components/ui/Field";
import { QuoteListCard } from "@/components/quote/QuoteListCard";
import { QuoteListRow } from "@/components/quote/QuoteListRow";
import {
  DEFAULT_QUOTE_FILTERS,
  QUOTE_PAGE_SIZE,
  isQuoteSort,
  QUOTE_SORT_LABELS,
  type QuoteListFilters,
  type QuoteSort,
} from "@/lib/quote-list-filters";
import type { Quote } from "@/lib/types";
import { ArrowUpDown, Building2, ChevronLeft, ChevronRight, Contact, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Filter/sort bar + list for 견적 목록. Everything runs client-side over
 * the full list the page already loads (quotes.json is read whole anyway),
 * and the current filters are mirrored into the URL with replaceState, so
 * going back from a quote's detail page lands on the same filtered view. */
export function QuoteListView({
  quotes,
  portNameById,
  initialFilters,
  initialPage,
}: {
  quotes: Quote[];
  portNameById: Record<string, string>;
  initialFilters: QuoteListFilters;
  initialPage: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  // Rows fade in only on the initial page load. Once the user filters,
  // sorts, or pages, results swap in instantly - replaying the fade (rows
  // start invisible, then appear after a delay) on every keystroke read
  // as a loading flash.
  const [interacted, setInteracted] = useState(false);
  // Any filter/sort change starts over from page 1.
  const set = <K extends keyof QuoteListFilters>(key: K, value: QuoteListFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setInteracted(true);
  };
  const resetFilters = () => {
    setFilters((f) => ({ ...DEFAULT_QUOTE_FILTERS, sort: f.sort }));
    setPage(1);
    setInteracted(true);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== DEFAULT_QUOTE_FILTERS[key as keyof QuoteListFilters]) params.set(key, value);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters, page]);

  // 업체 / 담당자 dropdown options - names that appear on at least one quote.
  const customerOptions = useMemo(() => uniqueNames(quotes, (q) => q.input.customerName), [quotes]);
  const repOptions = useMemo(() => uniqueNames(quotes, (q) => q.input.preparedBy), [quotes]);

  const visible = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    const result = quotes.filter((q) => {
      const { input } = q;
      if (filters.customer && input.customerName.trim() !== filters.customer) return false;
      if (filters.rep && (input.preparedBy ?? "").trim() !== filters.rep) return false;
      const date = input.quoteDate.slice(0, 10);
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      if (needle) {
        const haystack = [
          q.quoteNumber,
          input.customerName,
          input.contactName,
          input.preparedBy,
          input.incoterms,
          portNameById[input.originPortId] ?? input.originPortId,
          portNameById[input.destinationPortId] ?? input.destinationPortId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const total = (q: Quote) => q.result.column.grandTotalKrw;
    // Ties (same 견적일) fall back to creation time so the order is stable.
    const byDate = (a: Quote, b: Quote) =>
      a.input.quoteDate.localeCompare(b.input.quoteDate) || a.createdAt.localeCompare(b.createdAt);
    const comparators: Record<QuoteSort, (a: Quote, b: Quote) => number> = {
      newest: (a, b) => byDate(b, a),
      oldest: byDate,
      priceAsc: (a, b) => total(a) - total(b) || byDate(b, a),
      priceDesc: (a, b) => total(b) - total(a) || byDate(b, a),
    };
    return result.sort(comparators[filters.sort]);
  }, [quotes, filters, portNameById]);

  const totalPages = Math.max(1, Math.ceil(visible.length / QUOTE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * QUOTE_PAGE_SIZE;
  const pageItems = visible.slice(pageStart, pageStart + QUOTE_PAGE_SIZE);

  function goToPage(next: number) {
    setPage(next);
    setInteracted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isFiltered =
    filters.q !== "" ||
    filters.customer !== "" ||
    filters.rep !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <>
      <div className="p-4 sm:px-6 border-b border-[var(--border-subtle)] flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <Input
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="견적번호·고객명·항구 검색"
              aria-label="검색"
              className="pl-9"
            />
          </div>
          <FilterCombobox
            value={filters.customer}
            onChange={(v) => set("customer", v)}
            aria-label="업체"
            placeholder="업체 검색 (전체)"
            icon={<Building2 size={15} />}
            className="lg:col-span-2"
            options={customerOptions}
          />
          <Dropdown
            value={filters.rep}
            onChange={(v) => set("rep", v)}
            aria-label="담당자"
            icon={<Contact size={15} />}
            className="lg:col-span-2"
            options={[
              { value: "", label: "전체 담당자" },
              ...repOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <DatePicker
              value={filters.from}
              max={filters.to || undefined}
              onChange={(v) => set("from", v)}
              placeholder="시작일"
              clearable
              rangeStart={filters.from}
              rangeEnd={filters.to}
              aria-label="견적일 시작"
              className="flex-1 min-w-0"
            />
            <span className="text-[var(--muted)] text-[13px]">~</span>
            <DatePicker
              value={filters.to}
              min={filters.from || undefined}
              onChange={(v) => set("to", v)}
              placeholder="종료일"
              clearable
              rangeStart={filters.from}
              rangeEnd={filters.to}
              aria-label="견적일 종료"
              className="flex-1 min-w-0"
            />
          </div>
          <Dropdown
            value={filters.sort}
            onChange={(v) => set("sort", isQuoteSort(v) ? v : "newest")}
            aria-label="정렬"
            icon={<ArrowUpDown size={15} />}
            className="sm:col-span-2 lg:col-span-2"
            options={Object.entries(QUOTE_SORT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div className="flex items-center justify-between text-[12.5px] text-[var(--muted)]">
          <span>
            {isFiltered ? (
              <>
                전체 {quotes.length}건 중 <span className="font-medium text-[var(--foreground)]">{visible.length}건</span>
              </>
            ) : (
              <>총 {quotes.length}건</>
            )}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
            >
              <RotateCcw size={13} />
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <CardContent className="py-16 text-center">
          <p className="text-[15px] font-medium">조건에 맞는 견적이 없습니다.</p>
          <p className="text-[13px] text-[var(--muted)] mt-1 mb-6">검색어나 기간을 바꿔 보세요.</p>
          <Button
            variant="secondary"
            icon={<RotateCcw size={15} />}
            className="mx-auto"
            onClick={resetFilters}
          >
            필터 초기화
          </Button>
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
                  <th className="px-6 py-3 font-medium whitespace-nowrap">담당자</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">견적일</th>
                  <th className="px-6 py-3 font-medium text-right whitespace-nowrap">합계</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((q, i) => (
                  <QuoteListRow
                    key={q.id}
                    quote={q}
                    portNameById={portNameById}
                    // Capped so a long list still settles quickly instead of
                    // trickling in row by row for several seconds - only the
                    // first screenful visibly cascades.
                    animationDelayMs={interacted ? undefined : 220 + Math.min(i, 10) * 30}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
            {pageItems.map((q, i) => (
              <QuoteListCard
                key={q.id}
                quote={q}
                portNameById={portNameById}
                animationDelayMs={interacted ? undefined : 220 + Math.min(i, 10) * 30}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              rangeLabel={`${pageStart + 1}–${pageStart + pageItems.length} / ${visible.length}건`}
              onChange={goToPage}
            />
          )}
        </>
      )}
    </>
  );
}

/** Page numbers to show: always the first and last page plus the current
 * one and its neighbours, with "…" filling any gap. */
function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(p - pages[i - 1] === 2 ? p - 1 : "gap");
    out.push(p);
  });
  return out;
}

function Pagination({
  page,
  totalPages,
  rangeLabel,
  onChange,
}: {
  page: number;
  totalPages: number;
  rangeLabel: string;
  onChange: (page: number) => void;
}) {
  const navButton =
    "w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[13px] transition-colors disabled:opacity-30 disabled:pointer-events-none";
  return (
    <nav
      aria-label="페이지"
      className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-[var(--border-subtle)]"
    >
      <span className="text-[12.5px] text-[var(--muted)]">{rangeLabel}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="이전 페이지"
          className={`${navButton} text-[var(--muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]`}
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="w-8 text-center text-[13px] text-[var(--muted)]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${navButton} ${
                p === page
                  ? "bg-[var(--accent)] text-white font-medium"
                  : "text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="다음 페이지"
          className={`${navButton} text-[var(--muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

function uniqueNames(quotes: Quote[], pick: (q: Quote) => string | undefined): string[] {
  const names = new Set<string>();
  for (const q of quotes) {
    const name = (pick(q) ?? "").trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}
