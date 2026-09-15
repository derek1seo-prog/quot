import { formatDate } from "@/lib/format";
import type { CompanyInfo, QuoteInput, QuoteResult } from "@/lib/types";

interface QuoteDocumentProps {
  company: CompanyInfo;
  quoteNumber: string | null;
  input: QuoteInput;
  result: QuoteResult;
  originLabel: string;
  destinationLabel: string;
}

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString("en-US")}`;
}

function foreign(n: number, currency: string) {
  const symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "";
  return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function QuoteDocument({
  company,
  quoteNumber,
  input,
  result,
  originLabel,
  destinationLabel,
}: QuoteDocumentProps) {
  const oceanFreightRow = result.chargeCatalog.find((c) => c.category === "OCEAN_FREIGHT");
  const localRows = result.chargeCatalog.filter((c) => c.category !== "OCEAN_FREIGHT");

  return (
    <div className="bg-white text-[var(--foreground)] w-full max-w-[900px] mx-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] print:shadow-none print:border-0 print:rounded-none overflow-hidden">
      <div className="p-8 sm:p-12 print:p-0">
        {/* Letterhead */}
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

        {/* Salutation */}
        <div className="pt-6 pb-2 text-[13px] leading-relaxed text-[var(--foreground)]">
          <p>
            수신: <span className="font-medium">{input.customerName}</span>
            {input.contactName ? ` (${input.contactName})` : ""} 귀중
          </p>
          <p>
            발신: <span className="font-medium">{company.nameKo ?? company.name}</span> / {input.preparedBy}
          </p>
          <p className="mt-3 text-[var(--muted)]">
            요청하신 견적 운임을 하기와 같이 안내 드리오니 검토 부탁드립니다.
          </p>
        </div>

        {/* Basic info */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 py-5 px-5 bg-[var(--sidebar-bg)] rounded-[var(--radius-md)]">
          <InfoField label="CUSTOMER" value={input.customerName} />
          <InfoField label="INCOTERMS" value={input.incoterms} />
          <InfoField label="POL" value={originLabel} />
          <InfoField label="POD" value={destinationLabel} />
          <InfoField label="VALID UNTIL" value={formatDate(input.validUntil)} />
          <InfoField label="HS CODE" value={input.hsCode || "-"} />
          <InfoField label="TRANSPORT" value={input.transportMode} />
          <InfoField label="EX-RATE" value={`USD 1 = ₩${result.exchangeRate.toLocaleString()}`} />
        </div>

        {/* Charges table */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-[var(--foreground)]">
                <th className="text-left py-2.5 pr-3 font-semibold text-[12px] uppercase tracking-wide text-[var(--muted)]">
                  Charge
                </th>
                <th className="text-left py-2.5 px-3 font-semibold text-[12px] uppercase tracking-wide text-[var(--muted)] w-16">
                  CUR
                </th>
                {result.columns.map((col) => (
                  <th
                    key={col.containerTypeId}
                    className="text-right py-2.5 px-3 font-semibold text-[12px] uppercase tracking-wide text-[var(--muted)]"
                  >
                    {col.containerLabel}
                    {col.quantity > 1 ? ` ×${col.quantity}` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oceanFreightRow && (
                <>
                  <ChargeRow
                    label={oceanFreightRow.nameKo}
                    sublabel={oceanFreightRow.name}
                    columns={result.columns}
                    chargeTypeId={oceanFreightRow.chargeTypeId}
                  />
                  <tr className="border-b border-[var(--border-subtle)]">
                    <td colSpan={2} className="py-2 pr-3 text-[12.5px] font-semibold text-[var(--muted)]">
                      Sub Total
                    </td>
                    {result.columns.map((col) => (
                      <td
                        key={col.containerTypeId}
                        className="py-2 px-3 text-right text-[12.5px] font-semibold text-[var(--muted)]"
                      >
                        {krw(col.oceanFreightSubtotalKrw)}
                      </td>
                    ))}
                  </tr>
                </>
              )}

              <tr>
                <td colSpan={2 + result.columns.length} className="pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  국내 부대비용 / Local &amp; Regional Charges
                </td>
              </tr>

              {localRows.map((row) => (
                <ChargeRow
                  key={row.chargeTypeId}
                  label={row.nameKo}
                  sublabel={row.name}
                  columns={result.columns}
                  chargeTypeId={row.chargeTypeId}
                />
              ))}

              <tr className="border-b border-[var(--border-subtle)]">
                <td colSpan={2} className="py-2 pr-3 text-[12.5px] font-semibold text-[var(--muted)]">
                  Sub Total
                </td>
                {result.columns.map((col) => (
                  <td
                    key={col.containerTypeId}
                    className="py-2 px-3 text-right text-[12.5px] font-semibold text-[var(--muted)]"
                  >
                    {krw(col.localSubtotalKrw)}
                  </td>
                ))}
              </tr>

              <tr>
                <td colSpan={2} className="pt-4 pr-3 text-[15px] font-bold">
                  Grand Total
                </td>
                {result.columns.map((col) => (
                  <td key={col.containerTypeId} className="pt-4 px-3 text-right">
                    <span className="text-[17px] font-bold text-[var(--accent)]">
                      {krw(col.grandTotalKrw)}
                    </span>
                    {col.missingRate && (
                      <p className="text-[11px] font-normal text-[var(--warning)] mt-0.5">
                        일부 요율 미등록
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        <div className="mt-8 pt-5 border-t border-[var(--border-subtle)] text-[12px] text-[var(--muted)] leading-relaxed">
          <p className="font-semibold text-[var(--foreground)] mb-1.5">비고 / Remarks</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>상기 견적은 {formatDate(input.validUntil)} 까지 유효합니다.</li>
            <li>환율 변동 시 운임 및 부대비용이 재계산될 수 있습니다. (적용 환율: USD 1 = ₩{result.exchangeRate.toLocaleString()})</li>
            <li>상기 금액은 원화(KRW) 환산 기준이며, 부가세가 포함된 항목은 별도 표기됩니다.</li>
            {input.remarks && <li>{input.remarks}</li>}
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-[var(--border-subtle)] text-[12px] text-[var(--muted)] text-right">
          {company.sealText ?? company.name}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="text-[13.5px] font-medium mt-0.5 text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ChargeRow({
  label,
  sublabel,
  columns,
  chargeTypeId,
}: {
  label: string;
  sublabel: string;
  columns: QuoteResult["columns"];
  chargeTypeId: string;
}) {
  const firstWithItem = columns
    .map((c) => c.lineItems.find((li) => li.chargeTypeId === chargeTypeId))
    .find(Boolean);

  return (
    <tr className="border-b border-[var(--border-subtle)]">
      <td className="py-2 pr-3">
        <p className="font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-[11px] text-[var(--muted)]">{sublabel}</p>
      </td>
      <td className="py-2 px-3 text-[var(--muted)]">{firstWithItem?.currency ?? "-"}</td>
      {columns.map((col) => {
        const item = col.lineItems.find((li) => li.chargeTypeId === chargeTypeId);
        return (
          <td key={col.containerTypeId} className="py-2 px-3 text-right">
            {item ? (
              <div>
                <p className="text-[var(--foreground)]">{krw(item.amountKrw)}</p>
                {item.currency !== "KRW" && (
                  <p className="text-[11px] text-[var(--muted)]">
                    {foreign(item.rate, item.currency)}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-[var(--warning)] text-[12px]">미등록</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
