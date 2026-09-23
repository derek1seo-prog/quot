"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";

export function QuoteActions({
  quoteId,
  quoteNumber,
}: {
  quoteId: string;
  quoteNumber: string;
}) {
  const [exporting, setExporting] = useState(false);

  function handlePrint() {
    window.open(`/quotes/${quoteId}/print?autoprint=1`, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const node = document.getElementById("quote-print-capture");
      if (!node) return;

      // Without this, a capture that lands mid webfont-swap renders with
      // the fallback font - a common source of the download looking
      // subtly different (and blurrier) than a real browser print.
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const nodeWidthCss = node.getBoundingClientRect().width;
      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        imageSmoothingQuality: "high",
      });
      // Measured rather than assumed to equal the `scale` option above,
      // since html2canvas-pro may itself factor in devicePixelRatio.
      const canvasPxPerCssPx = canvas.width / nodeWidthCss;

      // 인쇄's real print engine never splits a table row across a page
      // (print:break-inside-avoid) - the raster export must match that by
      // hand, since it just crops a single tall image into page-sized
      // slices. Collect each row's vertical span (in canvas px) so a page
      // break can be pulled up to sit between rows instead of through one.
      const rowSpans = Array.from(node.querySelectorAll("tr"))
        .map((tr) => {
          const r = tr.getBoundingClientRect();
          const nodeTop = node.getBoundingClientRect().top;
          return {
            top: (r.top - nodeTop) * canvasPxPerCssPx,
            bottom: (r.bottom - nodeTop) * canvasPxPerCssPx,
          };
        })
        .sort((a, b) => a.top - b.top);

      function safePageBreak(naiveBreakPx: number): number {
        if (naiveBreakPx >= canvas.height) return canvas.height;
        const cutRow = rowSpans.find((row) => naiveBreakPx > row.top && naiveBreakPx < row.bottom);
        return cutRow ? cutRow.top : naiveBreakPx;
      }

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      // The image is always drawn at pageWidthMm wide, so this - not
      // canvasPxPerCssPx above - is the canvas-px<->mm conversion: canvas
      // pixels are a rendering-resolution detail, physical mm are what
      // jsPDF's addImage(x, y, widthMm, heightMm) actually places on paper.
      const canvasPxPerMm = canvas.width / pageWidthMm;
      const pageHeightPx = pageHeightMm * canvasPxPerMm;

      let cursorPx = 0;
      let firstPage = true;
      while (cursorPx < canvas.height) {
        const naiveBreakPx = Math.min(cursorPx + pageHeightPx, canvas.height);
        // A single row taller than a full page can't be avoided - fall
        // back to the naive break rather than loop forever.
        const breakPx = Math.max(safePageBreak(naiveBreakPx), cursorPx + 1);
        const sliceHeightPx = Math.round(Math.min(breakPx, canvas.height) - cursorPx);

        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeightPx;
        slice.getContext("2d")!.drawImage(
          canvas,
          0,
          cursorPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );

        if (!firstPage) pdf.addPage();
        pdf.addImage(
          slice.toDataURL("image/png"),
          "PNG",
          0,
          0,
          pageWidthMm,
          sliceHeightPx / canvasPxPerMm,
        );

        cursorPx += sliceHeightPx;
        firstPage = false;
      }

      pdf.save(`${quoteNumber}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
      <LinkButton href="/quotes" variant="ghost" size="sm" icon={<ArrowLeft size={15} />}>
        견적 목록으로
      </LinkButton>
      {/* TEMPORARY: 인쇄 is styled as the recommended action and PDF
          다운로드 is deliberately muted - 인쇄 currently matches the
          desired output more closely than the PDF export. Swap the
          variants back (인쇄 -> secondary, PDF 다운로드 -> primary) and
          drop the badge once the PDF export is back on par. */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Badge tone="accent">권장</Badge>
          <Button size="sm" onClick={handlePrint} icon={<Printer size={15} />}>
            인쇄
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={exporting}
          icon={exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        >
          {exporting ? "PDF 생성 중..." : "PDF 다운로드"}
        </Button>
      </div>
    </div>
  );
}
