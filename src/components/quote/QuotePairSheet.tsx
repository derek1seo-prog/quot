"use client";

import type { CompanyInfo, QuoteInput, QuoteResult } from "@/lib/types";
import { useLayoutEffect, useRef, useState } from "react";
import { QuoteDocument } from "./QuoteDocument";

// Two portrait print layouts (each designed at A4 width, 210mm) shrunk to
// half of an A4 landscape sheet: 148.5 / 210.
const SHEET_W_MM = 297;
const HALF_ZOOM = SHEET_W_MM / 2 / 210;
const MM_TO_PX = 96 / 25.4;

interface QuotePairSheetProps {
  company: CompanyInfo;
  quoteNumber: string | null;
  input: QuoteInput;
  result: QuoteResult;
  pairedResult: QuoteResult;
  originLabel: string;
  destinationLabel: string;
  /** Scale the sheet down to fit its container (on-screen preview). Off for
   * the actual print copy, which must stay at true A4 landscape size. */
  fitToWidth?: boolean;
}

/** The quick quote's "20FT+40HQ" output: the regular print layout for each
 * container, side by side on one A4 landscape page. While mounted it also
 * switches the page's print size to landscape. */
export function QuotePairSheet({
  company,
  quoteNumber,
  input,
  result,
  pairedResult,
  originLabel,
  destinationLabel,
  fitToWidth = false,
}: QuotePairSheetProps) {
  const docs = [
    { input, result },
    { input: { ...input, container: input.pairedContainer ?? input.container }, result: pairedResult },
  ];

  const sheet = (
    <div className="flex bg-white" style={{ width: `${SHEET_W_MM}mm` }}>
      {docs.map((d, i) => (
        <div
          key={i}
          className={i === 1 ? "border-l border-dashed border-[var(--border)]" : ""}
          style={{ width: "210mm", zoom: HALF_ZOOM, flexShrink: 0 }}
        >
          <QuoteDocument
            company={company}
            quoteNumber={quoteNumber}
            input={d.input}
            result={d.result}
            originLabel={originLabel}
            destinationLabel={destinationLabel}
            forceTable
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style>
      {fitToWidth ? (
        <FitToWidth naturalWidthPx={SHEET_W_MM * MM_TO_PX}>{sheet}</FitToWidth>
      ) : (
        <div className="print-center-landscape">{sheet}</div>
      )}
    </>
  );
}

function FitToWidth({ naturalWidthPx, children }: { naturalWidthPx: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / naturalWidthPx));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidthPx]);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white"
    >
      <div style={{ zoom }}>{children}</div>
    </div>
  );
}
