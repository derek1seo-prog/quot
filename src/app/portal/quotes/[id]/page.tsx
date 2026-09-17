import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { QuoteActions } from "@/components/quote/QuoteActions";
import { getCompany, getPortById, getQuoteById } from "@/lib/data-store";
import { getSession } from "@/lib/auth/require";
import { notFound, redirect } from "next/navigation";

export default async function PortalQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "customer") redirect("/login");

  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote || quote.input.customerId !== session.sub) notFound();

  const company = getCompany();
  const originPort = getPortById(quote.input.originPortId);
  const destinationPort = getPortById(quote.input.destinationPortId);

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <QuoteActions quoteId={quote.id} quoteNumber={quote.quoteNumber} backHref="/portal" backLabel="내 견적으로" />
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
