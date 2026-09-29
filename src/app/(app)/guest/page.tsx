import { PublicQuoteForm } from "@/components/quote/PublicQuoteForm";
import { getCompany, getContainerTypes, getPorts, getRegions } from "@/lib/data-store";

export default function GuestPage() {
  const ports = getPorts();
  const originPorts = ports.filter((p) => p.role !== "DESTINATION");
  const destinationPorts = ports.filter((p) => p.role !== "ORIGIN");

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16 print:py-0 print:px-0">
      <div className="no-print">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">게스트 모드</p>
        <h1 className="text-[28px] font-semibold tracking-tight mb-1">견적 조회</h1>
        <p className="text-[13px] text-[var(--muted)] mb-8">
          출발지와 도착지, 컨테이너 타입을 선택하면 견적을 체험해볼 수 있습니다.
        </p>
      </div>

      <PublicQuoteForm
        mode="guest"
        originPorts={originPorts}
        destinationPorts={destinationPorts}
        regions={getRegions()}
        containerTypes={getContainerTypes()}
        company={getCompany()}
      />
    </div>
  );
}
