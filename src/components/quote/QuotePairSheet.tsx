"use client";

import type { CompanyInfo, QuoteInput, QuoteResult } from "@/lib/types";
import { Maximize2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ].map((d) => (
    <QuoteDocument
      key={d.result.column.containerTypeId}
      company={company}
      quoteNumber={quoteNumber}
      input={d.input}
      result={d.result}
      originLabel={originLabel}
      destinationLabel={destinationLabel}
      forceTable
    />
  ));

  const sheet = (
    <div className="flex bg-white" style={{ width: `${SHEET_W_MM}mm` }}>
      {docs.map((doc, i) => (
        <div
          key={i}
          className={i === 1 ? "border-l border-dashed border-[var(--border)]" : ""}
          style={{ width: "210mm", zoom: HALF_ZOOM, flexShrink: 0 }}
        >
          {doc}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style>
      {fitToWidth ? (
        <FitToWidth naturalWidthPx={SHEET_W_MM * MM_TO_PX} docs={docs}>
          {sheet}
        </FitToWidth>
      ) : (
        <div className="print-center-landscape">{sheet}</div>
      )}
    </>
  );
}

const DOC_W_PX = 210 * MM_TO_PX;

/** Scales the sheet down to its container's width - its text is too small
 * to read there, so clicking it opens the two sheets large in a modal (same
 * overlay/animation pattern as ConfirmDialog): side by side on a wide
 * window, stacked full-width on a narrow one (a tablet held upright). */
function FitToWidth({
  naturalWidthPx,
  docs,
  children,
}: {
  naturalWidthPx: number;
  docs: React.ReactNode[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(false);
  const [modalLayout, setModalLayout] = useState({ cols: 2, zoom: 1 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / naturalWidthPx));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidthPx]);

  useEffect(() => {
    if (!open) return;
    // As wide as the window allows (readable), within sane bounds; on a
    // narrow screen it stays at the minimum and the modal scrolls instead.
    const fit = () => {
      const w = window.innerWidth;
      const cols = w >= 1024 ? 2 : 1;
      const gutter = (w >= 640 ? 64 : 32) + (cols - 1) * 24;
      setModalLayout({ cols, zoom: Math.min(1.3, Math.max(0.45, (w - gutter) / cols / DOC_W_PX)) });
    };
    fit();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", fit);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", fit);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const closeOnSelf = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <div>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="견적서 크게 보기"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="group relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white cursor-zoom-in transition-colors hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)]"
      >
        <div style={{ zoom }}>{children}</div>
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)]/80 px-2.5 py-1 text-[11.5px] font-medium text-white shadow-md transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 size={12} /> 크게 보기
        </span>
      </div>
      <p className="mt-2 text-center text-[12px] text-[var(--muted)]">클릭하면 크게 볼 수 있어요</p>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="견적서 크게 보기"
            className="no-print fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-[2px] animate-modal-backdrop"
            onClick={closeOnSelf}
          >
            <div className="sticky top-0 left-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-8 py-3 bg-[var(--foreground)]/85 text-white backdrop-blur">
              <p className="text-[13.5px] font-medium">견적서 크게 보기 · 20FT / 40HQ</p>
              <button
                type="button"
                autoFocus
                onClick={close}
                aria-label="닫기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="w-fit mx-auto p-4 sm:p-8 grid gap-6 animate-modal-panel"
              style={{ gridTemplateColumns: `repeat(${modalLayout.cols}, auto)` }}
              onClick={closeOnSelf}
            >
              {docs.map((doc, i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-md)] overflow-hidden bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                >
                  <div style={{ width: "210mm", zoom: modalLayout.zoom }}>{doc}</div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
