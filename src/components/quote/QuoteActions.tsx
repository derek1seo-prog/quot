"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";

export function QuoteActions({
  quoteId,
  quoteNumber,
  backHref = "/admin/quotes",
  backLabel = "견적 목록으로",
}: {
  quoteId: string;
  quoteNumber: string;
  backHref?: string;
  backLabel?: string;
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

      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${quoteNumber}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
      <LinkButton href={backHref} variant="ghost" size="sm" icon={<ArrowLeft size={15} />}>
        {backLabel}
      </LinkButton>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handlePrint} icon={<Printer size={15} />}>
          인쇄
        </Button>
        <Button
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
