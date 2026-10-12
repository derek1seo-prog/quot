"use client";

import type { CompanyInfo, QuoteInput, QuoteResult } from "@/lib/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const LENS_W = 440;
const LENS_H = 280;
// Sheet zoom inside the lens: a fixed, readable size (the sheet's own text
// is ~7px at zoom 1), whatever the fitted preview's size happens to be.
const LENS_ZOOM = 1.35;

/** Scales the sheet down to its container's width, with a magnifier lens
 * over it - the fitted sheet's text is too small to read. The lens follows
 * a mouse; on touch, a tap shows it at that spot and a second tap (or one
 * anywhere else) hides it. Positioned through refs, so moving the mouse
 * never re-renders the (heavy) sheet. */
function FitToWidth({ naturalWidthPx, children }: { naturalWidthPx: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensContentRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [lensOn, setLensOn] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / naturalWidthPx));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidthPx]);

  // Touch: a tap anywhere outside the sheet closes the lens.
  useEffect(() => {
    if (!lensOn) return;
    const close = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !ref.current?.contains(e.target as Node)) setLensOn(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [lensOn]);

  function placeLens(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      // Kept inside the sheet's box so it never causes sideways scroll.
      const left = Math.min(Math.max(x - LENS_W / 2, 0), Math.max(rect.width - LENS_W, 0));
      const top = Math.min(Math.max(y - LENS_H / 2, 0), Math.max(rect.height - LENS_H, 0));
      const magnified = Math.max(LENS_ZOOM, zoom * 1.4);
      if (lensRef.current) lensRef.current.style.transform = `translate(${left}px, ${top}px)`;
      // The point under the cursor sits at the same spot inside the lens.
      if (lensContentRef.current) {
        lensContentRef.current.style.transform = `translate(${x - left - (x / zoom) * magnified}px, ${
          y - top - (y / zoom) * magnified
        }px)`;
      }
    });
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white cursor-zoom-in"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            placeLens(e.clientX, e.clientY);
            if (!lensOn) setLensOn(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setLensOn(false);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            if (lensOn) {
              setLensOn(false);
            } else {
              placeLens(e.clientX, e.clientY);
              setLensOn(true);
            }
          }}
        >
          <div style={{ zoom }}>{children}</div>
        </div>
        <div
          ref={lensRef}
          data-quote-lens
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-opacity duration-150 ${
            lensOn ? "opacity-100" : "opacity-0"
          }`}
          style={{ width: LENS_W, height: LENS_H }}
        >
          <div ref={lensContentRef} className="absolute left-0 top-0">
            <div style={{ zoom: Math.max(LENS_ZOOM, zoom * 1.4) }}>{children}</div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] text-[var(--muted)]">
        마우스를 올리면 확대해서 볼 수 있어요 (태블릿은 탭)
      </p>
    </div>
  );
}
