"use client";

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
      const res = await fetch(`/api/quotes/${quoteId}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF 생성에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
      <LinkButton href="/quotes" variant="ghost" size="sm" icon={<ArrowLeft size={15} />}>
        견적 목록으로
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
