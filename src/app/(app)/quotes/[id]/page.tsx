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
    <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
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
    </div>
  );
}
