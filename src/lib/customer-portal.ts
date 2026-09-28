/** Shared between src/app/(app)/my/page.tsx (display) and
 * src/app/api/quotes/route.ts (the actual server-side enforcement) - a
 * customer-issued quote's "견적 담당자" is always this fixed value, matching
 * the admin wizard's own default (src/app/(app)/quotes/new/page.tsx). No
 * per-customer assignment exists yet; this is the simplest thing that
 * satisfies "시스템에 등록된 담당자로 자동 지정" without inventing new
 * admin-configurable state that wasn't asked for. */
export const CUSTOMER_QUOTE_PREPARED_BY = "김태현 대리";
