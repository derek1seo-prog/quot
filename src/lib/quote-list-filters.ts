/** Shared between the 견적 목록 server page (parsing ?q=&customer=&rep=&from=&to=&sort=)
 * and the client-side QuoteListView that applies them. */
export type QuoteSort = "newest" | "oldest" | "priceAsc" | "priceDesc";

export interface QuoteListFilters {
  q: string;
  customer: string;
  rep: string;
  from: string;
  to: string;
  sort: QuoteSort;
}

export const DEFAULT_QUOTE_FILTERS: QuoteListFilters = {
  q: "",
  customer: "",
  rep: "",
  from: "",
  to: "",
  sort: "newest",
};

export const QUOTE_SORT_LABELS: Record<QuoteSort, string> = {
  newest: "최신순",
  oldest: "오래된순",
  priceAsc: "금액 낮은순",
  priceDesc: "금액 높은순",
};

export function isQuoteSort(v: unknown): v is QuoteSort {
  return typeof v === "string" && v in QUOTE_SORT_LABELS;
}

export const QUOTE_PAGE_SIZE = 20;

export function parseQuoteListPage(params: Record<string, string | string[] | undefined>): number {
  const n = Number(typeof params.page === "string" ? params.page : "");
  return Number.isInteger(n) && n > 1 ? n : 1;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseQuoteListFilters(
  params: Record<string, string | string[] | undefined>,
): QuoteListFilters {
  const str = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };
  const sort = str("sort");
  return {
    q: str("q"),
    customer: str("customer"),
    rep: str("rep"),
    from: DATE_RE.test(str("from")) ? str("from") : "",
    to: DATE_RE.test(str("to")) ? str("to") : "",
    sort: isQuoteSort(sort) ? sort : DEFAULT_QUOTE_FILTERS.sort,
  };
}
