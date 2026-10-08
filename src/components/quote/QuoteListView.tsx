"use client";

import { Button } from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import { FilterCombobox } from "@/components/ui/FilterCombobox";
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
import { matchesSearch } from "@/lib/hangul";
import { ArrowUpDown, Building2, ChevronLeft, ChevronRight, Contact, RotateCcw, Search, SearchX, X } from "lucide-react";
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
          .join(" ");
        if (!matchesSearch(haystack, needle)) return false;
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

  // Applied filters as removable chips (the search panel's state, restated).
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q.trim()) chips.push({ key: "q", label: `검색: “${filters.q.trim()}”`, clear: () => set("q", "") });
  if (filters.customer) chips.push({ key: "customer", label: `업체: ${filters.customer}`, clear: () => set("customer", "") });
  if (filters.rep) chips.push({ key: "rep", label: `담당자: ${filters.rep}`, clear: () => set("rep", "") });
  if (filters.from || filters.to) {
    const fmt = (iso: string) => (iso ? iso.slice(2).replace(/-/g, ".") : "");
    chips.push({
      key: "date",
      label: `견적일: ${fmt(filters.from) || "처음"} ~ ${fmt(filters.to) || "오늘"}`,
      clear: () => {
        setFilters((f) => ({ ...f, from: "", to: "" }));
        setPage(1);
        setInteracted(true);
      },
    });
  }

  return (
    <>
      {/* 검색 패널 - its own card, so filtering reads as a separate step from the results */}
      <section className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="견적번호, 고객명, 항구로 검색"
            aria-label="검색"
            className="w-full h-12 pl-11 pr-4 rounded-[12px] border border-transparent bg-[#f1f5f9] text-[14.5px] text-[var(--foreground)] outline-none transition-all placeholder:text-[#94a3b8] focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr] gap-3">
          <FilterField label="업체">
            <FilterCombobox
              value={filters.customer}
              onChange={(v) => set("customer", v)}
              aria-label="업체"
              placeholder="전체 업체"
              icon={<Building2 size={15} />}
              options={customerOptions}
            />
          </FilterField>
          <FilterField label="담당자">
            <Dropdown
              value={filters.rep}
              onChange={(v) => set("rep", v)}
              aria-label="담당자"
              icon={<Contact size={15} />}
              options={[
                { value: "", label: "전체 담당자" },
                ...repOptions.map((name) => ({ value: name, label: name })),
              ]}
            />
          </FilterField>
          <FilterField label="견적일" className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
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
          </FilterField>
        </div>
      </section>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] pl-3 pr-1 py-1 text-[12.5px] font-medium text-[var(--accent)]"
            >
              {c.label}
              <button
                type="button"
                onClick={c.clear}
                aria-label={`${c.label} 해제`}
                className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-[var(--accent)]/15"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-1 inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <RotateCcw size={12} />
            모두 지우기
          </button>
        </div>
      )}

      {/* 결과 */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] text-[var(--foreground)] whitespace-nowrap">
            <span className="font-semibold">{isFiltered ? "검색 결과" : "전체 견적"}</span>
            <span className="ml-2 font-semibold text-[var(--accent)] tabular-nums">{visible.length}</span>
            <span className="text-[var(--muted)]">건</span>
            {isFiltered && <span className="hidden sm:inline ml-1.5 text-[12.5px] text-[var(--muted)]">/ 전체 {quotes.length}건</span>}
          </p>
          <Dropdown
            value={filters.sort}
            onChange={(v) => set("sort", isQuoteSort(v) ? v : "newest")}
            aria-label="정렬"
            icon={<ArrowUpDown size={14} />}
            className="w-[148px] shrink-0"
            options={Object.entries(QUOTE_SORT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>

        {visible.length === 0 ? (
          <CardContent className="py-16 text-center">
            <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center text-[var(--muted)]">
              <SearchX size={20} />
            </span>
            <p className="text-[15px] font-medium">조건에 맞는 견적이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1 mb-6">검색어나 필터를 바꿔 보세요.</p>
            <Button variant="secondary" icon={<RotateCcw size={15} />} className="mx-auto" onClick={resetFilters}>
              필터 초기화
            </Button>
          </CardContent>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left min-w-[840px]">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
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
      </section>
    </>
  );
}

/** Small caption above each filter control in the search panel. */
function FilterField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11.5px] font-medium text-[var(--muted)]">{label}</p>
      {children}
    </div>
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
