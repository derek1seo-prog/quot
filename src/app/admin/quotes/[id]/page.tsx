import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { QuoteActions } from "@/components/quote/QuoteActions";
import { getCompany, getPortById, getQuoteById } from "@/lib/data-store";
import { notFound } from "next/navigation";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  const company = getCompany();
  const originPort = getPortById(quote.input.originPortId);
  const destinationPort = getPortById(quote.input.destinationPortId);

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <QuoteActions quoteId={quote.id} quoteNumber={quote.quoteNumber} />
      <div id="quote-document-root">
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
        />
      </div>
      {/* Off-screen, laid-out-but-invisible copy of the formal print
          layout, captured by the "PDF 다운로드" button instead of the
          spacious on-screen preview above - so the PDF matches what
          printing produces. Positioned off-canvas rather than
          display:none so html2canvas can still measure/render it. */}
      <div id="quote-print-capture" className="fixed -left-[10000px] top-0 w-[210mm]" aria-hidden>
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
    </div>
  );
}
