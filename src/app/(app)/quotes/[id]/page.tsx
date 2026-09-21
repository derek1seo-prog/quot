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
      {/* Off-screen, laid-out-but-invisible copy of the spacious on-screen
          preview style (not forceTable's dense print layout), captured by
          the "PDF 다운로드" button - the user asked for the 해상운임/국내
          부대비용 category grouping to be as easy to read in the download
          as it is on screen, even at the cost of no longer matching 인쇄's
          exact density/layout. Positioned off-canvas rather than
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
        // 900px matches QuoteDocument's own max-w-[900px] card width (the
        // width it naturally renders at on screen) - not 210mm A4 width,
        // since the spacious table has a 740px min-width that a 210mm-wide
        // (~794px) container can't comfortably fit alongside its own
        // padding, clipping the rightmost column. jsPDF scales whatever
        // width this captures down to the PDF's A4 page width anyway, so
        // the source width just needs to fit the content, not match A4.
        className="fixed -left-[10000px] top-0 w-[900px] tracking-normal"
        aria-hidden
      >
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
