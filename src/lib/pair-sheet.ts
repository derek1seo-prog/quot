/** Layout of the 20FT+40HQ landscape sheet, shared by the print/preview
 * component (QuotePairSheet) and the PDF export's capture nodes (quote
 * detail page). Each half is the normal print layout in its `compact`
 * form, laid out narrower than A4 so it can be scaled up more: about 0.9x
 * instead of 0.71x, while the table still fits on one line per row. */
export const PAIR_SHEET_W_MM = 297;
export const PAIR_SHEET_H_MM = 210;
export const PAIR_HALF_W_MM = PAIR_SHEET_W_MM / 2;
export const PAIR_DOC_W_MM = 165;
