/** Which SalesRep a customer-issued quote's "견적 담당자" (발신) is always
 * assigned to - resolved against src/data/sales-reps.json (via
 * getSalesRepById) by both src/app/(app)/my/page.tsx (display/preview) and
 * src/app/api/quotes/route.ts (server-side enforcement). Storing an id
 * rather than a bare name string means editing that rep's email/phone in
 * /sales-reps automatically applies to future customer-issued quotes,
 * without touching this file. */
export const DEFAULT_SALES_REP_ID = "rep-thkim";
/** Defensive fallback name only, for the unlikely case the referenced rep
 * record is ever missing - keeps a customer's 발신 line from rendering
 * blank instead of crashing. */
export const DEFAULT_SALES_REP_FALLBACK_NAME = "김태현 대리";
