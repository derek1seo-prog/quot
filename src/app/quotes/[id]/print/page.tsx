import { AutoPrint } from "@/components/quote/AutoPrint";
import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { getCompany, getPortById, getQuoteById } from "@/lib/data-store";
import { notFound } from "next/navigation";

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
  );
}
