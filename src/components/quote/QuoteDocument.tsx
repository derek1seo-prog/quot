import { formatDate } from "@/lib/format";
import type { CompanyInfo, QuoteInput, QuoteResult } from "@/lib/types";

interface QuoteDocumentProps {
  company: CompanyInfo;
  quoteNumber: string | null;
  input: QuoteInput;
  result: QuoteResult;
  originLabel: string;
  destinationLabel: string;
  /** Always render the full table, even below the `sm` breakpoint, and
   * switch to the compact, single-page letter layout (used by the print
   * route and the PDF export) instead of the spacious on-screen preview. */
  forceTable?: boolean;
}

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString("en-US")}`;
}

function foreign(n: number, currency: string) {
  const symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "";
  return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// Charges VAT will be applied to separately - shaded in the table so
// customers can see at a glance which lines that applies to.
const VAT_APPLICABLE_CHARGE_TYPE_IDS = new Set(["INLAND_TRUCKING", "DOC_FEE", "HANDLING_CHG"]);

export function QuoteDocument({
  company,
  quoteNumber,
  input,
  result,
  originLabel,
  destinationLabel,
  forceTable = false,
}: QuoteDocumentProps) {
  const oceanFreightRow = result.chargeCatalog.find((c) => c.category === "OCEAN_FREIGHT");
  const localRows = result.chargeCatalog
    .filter((c) => c.category !== "OCEAN_FREIGHT")
    .sort((a, b) => {
      const aVat = VAT_APPLICABLE_CHARGE_TYPE_IDS.has(a.chargeTypeId) ? 1 : 0;
      const bVat = VAT_APPLICABLE_CHARGE_TYPE_IDS.has(b.chargeTypeId) ? 1 : 0;
      return aVat - bVat;
    });
  const containerSummary = `${result.column.containerLabel} × ${result.column.quantity}`;

  const categoryColPct = 12;
  const itemColPct = 42;
  const curColPct = 10;
  const rateColPct = 12;
  const qtyColPct = 7;
  const priceColPct = 17;

  return (
    <div
      className={`bg-white text-[var(--foreground)] w-full mx-auto overflow-hidden print:shadow-none print:border-0 print:rounded-none print:max-w-none print:w-full ${
        forceTable
          ? "max-w-none rounded-none border-0 shadow-none"
          : "max-w-[900px] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className={forceTable ? "p-[12mm]" : "p-8 sm:p-12"}>
        {forceTable ? (
          <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-[var(--foreground)]">
            <div className="flex items-center gap-2.5">
              {/* Plain <img>, not next/image: this markup is also captured
                  by html2canvas for the PDF export, which needs the image
                  already resolved in the DOM rather than behind Next's
                  optimization proxy/srcset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-[15px] font-bold tracking-tight">{company.name}</h1>
                {company.nameKo && (
                  <p className="text-[10.5px] text-[var(--muted)]">{company.nameKo}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10.5px] uppercase tracking-wide text-[var(--muted)] font-semibold">
                {input.transportMode} Freight Quotation
              </p>
              <p className="text-[12px] font-semibold mt-1">
                {quoteNumber ?? <span className="text-[var(--warning)]">DRAFT</span>}
              </p>
            </div>
          </div>
        ) : (
          /* Letterhead (on-screen preview) */
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-[var(--foreground)]">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">{company.name}</h1>
              {company.nameKo && (
                <p className="text-[13px] text-[var(--muted)] mt-0.5">{company.nameKo}</p>
              )}
              <p className="text-[12px] text-[var(--muted)] mt-3 leading-relaxed max-w-sm">
                {company.addressLines.join(", ")}
              </p>
              <p className="text-[12px] text-[var(--muted)] mt-1">
                TEL {company.tel}
                {company.fax ? `  ·  FAX ${company.fax}` : ""}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                {company.email}
                {company.website ? `  ·  ${company.website}` : ""}
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[12px] uppercase tracking-wide text-[var(--muted)] font-medium">
                Freight Quotation
              </p>
              <p className="text-[13px] font-semibold mt-1">
                {quoteNumber ?? <span className="text-[var(--warning)]">DRAFT</span>}
              </p>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">{formatDate(input.quoteDate)}</p>
            </div>
          </div>
        )}

        {/* Addressee - same 수신/발신 format on-screen and in print/PDF */}
        <div
          className={`text-[var(--foreground)] space-y-0.5 ${
            forceTable ? "pt-3 text-[11px]" : "pt-6 pb-2 text-[13px] leading-relaxed"
          }`}
        >
          <p>
            수신 : <span className="font-medium">{input.customerName}</span>
            {input.contactName ? ` / ${input.contactName}` : ""}
          </p>
          <p>
            발신 : <span className="font-medium">{company.nameKo ?? company.name}</span> / {input.preparedBy}
          </p>
        </div>

        {forceTable ? (
          <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 py-3 border-t border-b border-[var(--border-subtle)]">
            <InfoField dense label="INCOTERMS" value={input.incoterms} />
            <InfoField dense label="POL" value={originLabel} />
            <InfoField dense label="POD" value={destinationLabel} />
            <InfoField dense label="CONTAINER" value={containerSummary} />
            <InfoField dense label="VALID UNTIL" value={formatDate(input.validUntil)} />
            <InfoField dense label="EX-RATE" value={`USD 1 = ₩${result.exchangeRate.toLocaleString()}`} />
            {input.hsCode && <InfoField dense label="HS CODE" value={input.hsCode} />}
          </div>
        ) : (
          /* Basic info (on-screen preview) */
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 py-5 px-5 bg-[var(--sidebar-bg)] rounded-[var(--radius-md)]">
            <InfoField label="CUSTOMER" value={input.customerName} />
            <InfoField label="INCOTERMS" value={input.incoterms} />
            <InfoField label="POL" value={originLabel} />
            <InfoField label="POD" value={destinationLabel} />
            <InfoField label="CONTAINER" value={containerSummary} />
            <InfoField label="VALID UNTIL" value={formatDate(input.validUntil)} />
            <InfoField label="HS CODE" value={input.hsCode || "-"} />
            <InfoField label="EX-RATE" value={`USD 1 = ₩${result.exchangeRate.toLocaleString()}`} />
          </div>
        )}

        {/* Charges - a flat table at sm: and up (or always, when forceTable
            is set for print/export); a stacked card below sm: so a phone
            never needs to scroll sideways. */}
        <div className={`${forceTable ? "mt-4" : "mt-8"} overflow-x-auto ${forceTable ? "" : "hidden sm:block"}`}>
          <table
            className={`w-full border-collapse table-fixed ${forceTable ? "text-[10.5px]" : "text-[13px] min-w-[740px]"}`}
          >
            <colgroup>
              <col style={{ width: `${categoryColPct}%` }} />
              <col style={{ width: `${itemColPct}%` }} />
              <col style={{ width: `${curColPct}%` }} />
              <col style={{ width: `${rateColPct}%` }} />
              <col style={{ width: `${qtyColPct}%` }} />
              <col style={{ width: `${priceColPct}%` }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-[var(--foreground)]">
                <th className={`text-left px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  구분
                </th>
                <th className={`text-left px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  항목
                </th>
                <th className={`text-left px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  기준통화
                </th>
                <th className={`text-right px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  단가
                </th>
                <th className={`text-right px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  수량
                </th>
                <th className={`text-right px-3.5 font-semibold uppercase tracking-wide text-[var(--muted)] ${forceTable ? "py-1.5 text-[9.5px]" : "py-2.5 text-[12px]"}`}>
                  견적가
                </th>
              </tr>
            </thead>
            <tbody>
              {oceanFreightRow && (
                <ChargeRow
                  label={oceanFreightRow.nameKo}
                  sublabel={oceanFreightRow.name}
                  column={result.column}
                  chargeTypeId={oceanFreightRow.chargeTypeId}
                  dense={forceTable}
                  categoryCell={{ label: "해상운임", rowSpan: 1 }}
                />
              )}

              {localRows.map((row, i) => (
                <ChargeRow
                  key={row.chargeTypeId}
                  label={row.nameKo}
                  sublabel={row.name}
                  column={result.column}
                  chargeTypeId={row.chargeTypeId}
                  dense={forceTable}
                  categoryCell={i === 0 ? { label: "국내 부대비용", rowSpan: localRows.length } : undefined}
                />
              ))}

              <tr
                className="print:break-inside-avoid bg-[var(--accent)]"
                style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
              >
                <td colSpan={4} className={`px-3.5 font-bold text-white ${forceTable ? "py-2.5 text-[13.5px]" : "py-3 text-[15px]"}`}>
                  최종가격(VAT 별도)
                </td>
                <td colSpan={2} className={`px-3.5 text-right ${forceTable ? "py-2.5" : "py-3"}`}>
                  <span className={`font-bold text-white whitespace-nowrap ${forceTable ? "text-[13.5px]" : "text-[17px]"}`}>
                    KRW {result.column.grandTotalKrw.toLocaleString()}
                  </span>
                  {result.column.missingRate && (
                    <p className="text-[11px] font-normal text-white/90 mt-0.5">
                      일부 요율 미등록
                    </p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!forceTable && (
          <div className="sm:hidden mt-8">
            <MobileChargeCard column={result.column} oceanFreightRow={oceanFreightRow} localRows={localRows} />
          </div>
        )}

        {/* Remarks */}
        <div
          className={`border-t border-[var(--border-subtle)] text-[var(--muted)] print:break-inside-avoid ${
            forceTable ? "mt-4 pt-3 text-[9px] leading-snug" : "mt-8 pt-5 text-[12px] leading-relaxed"
          }`}
        >
          <p className={`font-semibold text-[var(--foreground)] mb-1.5 ${forceTable ? "text-[9.5px]" : "text-[12px]"}`}>비고 / Remarks</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>상기 견적은 {formatDate(input.validUntil)} 까지 유효합니다.</li>
            <li>환율 변동 시 운임 및 부대비용이 재계산될 수 있습니다. (적용 환율: USD 1 = ₩{result.exchangeRate.toLocaleString()})</li>
            <li>상기 금액은 원화(KRW) 환산 기준이며, 부가세가 포함된 항목은 별도 표기됩니다.</li>
            {input.remarks && <li>{input.remarks}</li>}
          </ul>
        </div>

        {/* Footer */}
        <div
          className={`border-t border-[var(--border-subtle)] text-[var(--muted)] text-right ${
            forceTable ? "mt-4 pt-3 text-[9px]" : "mt-10 pt-4 text-[12px]"
          }`}
        >
          {forceTable ? (
            <>
              <p>
                {company.addressLines.join(", ")}
              </p>
              <p>
                TEL {company.tel}
                {company.fax ? `  ·  FAX ${company.fax}` : ""}
                {"  ·  "}
                {company.email}
                {company.website ? `  ·  ${company.website}` : ""}
              </p>
              <p className="mt-1 font-medium text-[var(--foreground)]">{company.sealText ?? company.name}</p>
            </>
          ) : (
            company.sealText ?? company.name
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, dense = false }: { label: string; value: string; dense?: boolean }) {
  return (
    <div>
      <p className={`font-semibold uppercase tracking-wide text-[var(--muted)] ${dense ? "text-[8.5px]" : "text-[10.5px]"}`}>
        {label}
      </p>
      <p className={`font-medium mt-0.5 text-[var(--foreground)] ${dense ? "text-[11px]" : "text-[13.5px]"}`}>{value}</p>
    </div>
  );
}

function ChargeRow({
  label,
  sublabel,
  column,
  chargeTypeId,
  dense = false,
  categoryCell,
}: {
  label: string;
  sublabel: string;
  column: QuoteResult["column"];
  chargeTypeId: string;
  dense?: boolean;
  /** Renders a rowSpan-merged 구분 (category) cell as the row's first cell -
   * pass this only on the first row of a category group; later rows in the
   * same group omit it, since the earlier cell's rowSpan already covers
   * them. */
  categoryCell?: { label: string; rowSpan: number };
}) {
  const item = column.lineItems.find((li) => li.chargeTypeId === chargeTypeId);
  const vatApplies = VAT_APPLICABLE_CHARGE_TYPE_IDS.has(chargeTypeId);

  return (
    <tr
      className={`border-b border-[var(--border-subtle)] print:break-inside-avoid ${
        vatApplies ? "bg-[var(--sidebar-bg)]" : ""
      }`}
      style={vatApplies ? { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } : undefined}
    >
      {categoryCell && (
        <td
          rowSpan={categoryCell.rowSpan}
          className={`px-3.5 align-top font-semibold text-[var(--muted)] border-r border-[var(--border-subtle)] whitespace-nowrap ${
            dense ? "py-1.5 text-[9.5px]" : "py-2 text-[12px]"
          }`}
        >
          {categoryCell.label}
        </td>
      )}
      <td className={`px-3.5 ${dense ? "py-1.5" : "py-2"}`}>
        {dense ? (
          <div className="flex flex-wrap items-baseline gap-x-1 font-medium text-[var(--foreground)] text-[10.5px]">
            <span className="inline-block w-[78px] shrink-0">{label}</span>
            <span className={`${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"} text-[9px]`}>({sublabel})</span>
          </div>
        ) : (
          <>
            <p className="font-medium text-[var(--foreground)]">{label}</p>
            <p className={`text-[11px] ${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{sublabel}</p>
          </>
        )}
      </td>
      <td className={`px-3.5 ${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"} ${dense ? "py-1.5 text-[10.5px]" : "py-2"}`}>{item?.currency ?? "-"}</td>
      <td className={`px-3.5 text-right ${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"} ${dense ? "py-1.5 text-[10.5px]" : "py-2"}`}>
        {item ? item.rate.toLocaleString("en-US") : "-"}
      </td>
      <td className={`px-3.5 text-right ${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"} ${dense ? "py-1.5 text-[10.5px]" : "py-2"}`}>{item?.quantity ?? "-"}</td>
      <td className={`px-3.5 text-right ${dense ? "py-1.5" : "py-2"}`}>
        {item ? (
          <span className={`text-[var(--foreground)] whitespace-nowrap ${dense ? "text-[10.5px]" : ""}`}>{krw(item.amountKrw)}</span>
        ) : (
          <span className={`text-[var(--warning)] ${dense ? "text-[10.5px]" : "text-[12px]"}`}>미등록</span>
        )}
      </td>
    </tr>
  );
}

/** Mobile (< sm) equivalent of the charges table: one card, stacked line
 * items instead of a table, so a phone never needs to scroll sideways. */
function MobileChargeCard({
  column,
  oceanFreightRow,
  localRows,
}: {
  column: QuoteResult["column"];
  oceanFreightRow: QuoteResult["chargeCatalog"][number] | undefined;
  localRows: QuoteResult["chargeCatalog"];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--sidebar-bg)]">
        <span className="font-semibold text-[14px] text-[var(--foreground)]">
          {column.quantity}× {column.containerLabel}
        </span>
        <span className="text-[15px] font-bold text-[var(--accent)]">
          {krw(column.grandTotalKrw)}
        </span>
      </div>

      <div className="px-4">
        {oceanFreightRow && (
          <MobileLineRow
            label={oceanFreightRow.nameKo}
            sublabel={oceanFreightRow.name}
            column={column}
            chargeTypeId={oceanFreightRow.chargeTypeId}
          />
        )}
        {localRows.map((row) => (
          <MobileLineRow
            key={row.chargeTypeId}
            label={row.nameKo}
            sublabel={row.name}
            column={column}
            chargeTypeId={row.chargeTypeId}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-[var(--sidebar-bg)]/60 border-t border-[var(--border-subtle)]">
        <span className="text-[13px] font-bold text-[var(--foreground)]">최종가격(VAT 별도)</span>
        <div className="text-right">
          <span className="text-[15px] font-bold text-[var(--accent)] whitespace-nowrap">
            KRW {column.grandTotalKrw.toLocaleString()}
          </span>
          {column.missingRate && (
            <p className="text-[11px] font-normal text-[var(--warning)]">일부 요율 미등록</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileLineRow({
  label,
  sublabel,
  column,
  chargeTypeId,
}: {
  label: string;
  sublabel: string;
  column: QuoteResult["column"];
  chargeTypeId: string;
}) {
  const item = column.lineItems.find((li) => li.chargeTypeId === chargeTypeId);
  const vatApplies = VAT_APPLICABLE_CHARGE_TYPE_IDS.has(chargeTypeId);
  return (
    <div
      className={`flex items-start justify-between gap-3 py-2.5 border-b border-[var(--border-subtle)] text-[13px] ${
        vatApplies ? "bg-[var(--sidebar-bg)] -mx-4 px-4" : ""
      }`}
    >
      <div>
        <p className="font-medium text-[var(--foreground)]">{label}</p>
        <p className={`text-[11px] ${vatApplies ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{sublabel}</p>
      </div>
      <div className="text-right shrink-0">
        {item ? (
          <>
            <p className="text-[var(--foreground)]">{krw(item.amountKrw)}</p>
            {!(item.quantity === 1 && item.currency === "KRW") && (
              <p className="text-[11px] text-[var(--muted)]">
                {item.currency === "KRW" ? krw(item.rate) : foreign(item.rate, item.currency)}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </p>
            )}
          </>
        ) : (
          <span className="text-[var(--warning)] text-[12px]">미등록</span>
        )}
      </div>
    </div>
  );
}
