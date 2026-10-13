import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { QuoteActions } from "@/components/quote/QuoteActions";
import { QuotePairSheet } from "@/components/quote/QuotePairSheet";
import { getCompany, getPortById, getQuoteById } from "@/lib/data-store";
import { PAIR_DOC_W_MM } from "@/lib/pair-sheet";
import { decodeSessionCookie } from "@/lib/session";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  // proxy.ts already lets any "customer" session reach /quotes/:id (the
  // path pattern is shared with admin) - this is the per-record ownership
  // check underneath it, so a customer can never view another customer's
  // saved quote just by guessing/incrementing an id.
  const session = decodeSessionCookie(await cookies());
  if (session?.role === "customer" && quote.input.customerId !== session.customerId) {
    notFound();
  }

  const company = getCompany();
  const originPort = getPortById(quote.input.originPortId);
  const destinationPort = getPortById(quote.input.destinationPortId);
  const originLabel = originPort ? `${originPort.nameKo} (${originPort.name})` : quote.input.originPortId;
  const destinationLabel = destinationPort
    ? `${destinationPort.nameKo} (${destinationPort.name})`
    : quote.input.destinationPortId;

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <div className="animate-dashboard-fade-up">
        <QuoteActions quoteId={quote.id} quoteNumber={quote.quoteNumber} />
      </div>
      <div id="quote-document-root" className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        {quote.pairedResult ? (
          <QuotePairSheet
            company={company}
            quoteNumber={quote.quoteNumber}
            input={quote.input}
            result={quote.result}
            pairedResult={quote.pairedResult}
            originLabel={originLabel}
            destinationLabel={destinationLabel}
            fitToWidth
          />
        ) : (
          <QuoteDocument
            company={company}
            quoteNumber={quote.quoteNumber}
            input={quote.input}
            result={quote.result}
            originLabel={originLabel}
            destinationLabel={destinationLabel}
          />
        )}
      </div>
      {/* Off-screen, laid-out-but-invisible copy of the formal print
          layout, captured by the "PDF 다운로드" button instead of the
          spacious on-screen preview above - so the PDF matches what
          printing produces. Positioned off-canvas rather than
          display:none so html2canvas can still measure/render it.
          tracking-normal resets the site-wide negative letter-spacing:
          html2canvas-pro only paints text with a single fillText per line
          when letter-spacing is exactly 0 - any nonzero value (including
          this site's -0.01em) makes it fall back to measuring and
          painting each glyph individually, which - for won signs, middle
          dots, parentheses next to Pretendard's CJK glyphs - visibly
          mispaints stray strikethrough-like artifacts through the text.
          Scoped to just this hidden capture node; the live preview, the
          real print page and the rest of the site keep their normal
          letter-spacing untouched. */}
      <div
        id="quote-print-capture"
        className="fixed -left-[10000px] top-0 tracking-normal"
        style={{ width: quote.pairedResult ? `${PAIR_DOC_W_MM}mm` : "210mm" }}
        aria-hidden
      >
        <QuoteDocument
          company={company}
          quoteNumber={quote.quoteNumber}
          input={quote.input}
          result={quote.result}
          originLabel={originLabel}
          destinationLabel={destinationLabel}
          forceTable
          compact={Boolean(quote.pairedResult)}
        />
      </div>
      {/* 20FT+40HQ quotes: the second sheet, captured separately and placed
          beside the first on a landscape page by QuoteActions (rather than
          capturing QuotePairSheet itself, whose CSS zoom html2canvas
          doesn't render reliably). */}
      {quote.pairedResult && quote.input.pairedContainer && (
        <div
          id="quote-print-capture-paired"
          className="fixed -left-[10000px] top-0 tracking-normal"
          style={{ width: `${PAIR_DOC_W_MM}mm` }}
          aria-hidden
        >
          <QuoteDocument
            company={company}
            quoteNumber={quote.quoteNumber}
            input={{ ...quote.input, container: quote.input.pairedContainer }}
            result={quote.pairedResult}
            originLabel={originLabel}
            destinationLabel={destinationLabel}
            forceTable
            compact
          />
        </div>
      )}
    </div>
  );
}
