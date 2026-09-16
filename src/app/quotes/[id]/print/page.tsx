import { AutoPrint } from "@/components/quote/AutoPrint";
import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { getCompany, getPortById, getQuoteById } from "@/lib/data-store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quote = await getQuoteById(id);
  const company = getCompany();
  return {
    title: `${quote?.quoteNumber ?? "견적서(초안)"} · ${company.nameKo ?? company.name}`,
  };
}

export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const { autoprint } = await searchParams;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  const company = getCompany();
  const originPort = getPortById(quote.input.originPortId);
  const destinationPort = getPortById(quote.input.destinationPortId);

  return (
    <div className="bg-[#f5f5f7] min-h-screen py-10 px-4 print:bg-white print:py-0 print:px-0">
      <AutoPrint enabled={autoprint === "1"} />
      <p className="no-print max-w-[900px] mx-auto mb-4 text-[12px] text-[var(--muted)] bg-[var(--accent-soft)] text-[var(--accent)] rounded-[var(--radius-md)] px-4 py-3">
        인쇄 시 상단/하단에 날짜나 주소가 함께 출력된다면, 인쇄 대화상자의 &ldquo;추가 설정&rdquo;에서 &ldquo;머리글과 바닥글&rdquo;을 꺼주세요. 브라우저가 자체적으로 추가하는 항목이라 이 페이지에서는 없앨 수 없습니다.
      </p>
      <QuoteDocument
        company={company}
        quoteNumber={quote.quoteNumber}
        input={quote.input}
        result={quote.result}
        originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : quote.input.originPortId}
        destinationLabel={
          destinationPort
            ? `${destinationPort.nameKo} (${destinationPort.name})`
            : quote.input.destinationPortId
        }
        forceTable
      />
    </div>
  );
}
