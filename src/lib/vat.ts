/** Korean VAT on the lines that carry it. */
export const VAT_RATE = 0.1;

/** Charges subject to VAT - shaded on the quote, and the base of the
 * "부가세 포함" total (QuoteInput.vatIncluded). One list for both, so what
 * looks taxed and what is taxed can't drift apart. */
export const VAT_APPLICABLE_CHARGE_TYPE_IDS: ReadonlySet<string> = new Set([
  "INLAND_TRUCKING",
  "DOC_FEE",
  "HANDLING_CHG",
]);
