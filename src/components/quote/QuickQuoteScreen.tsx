import { PublicQuoteForm } from "@/components/quote/PublicQuoteForm";
import { getCompany, getContainerTypes, getCustomers, getPorts, getRegions, getSalesReps } from "@/lib/data-store";

/** Shared by "/" (shown to anyone not logged in as admin) and "/quick-quote"
 * (reachable by admins too, as its own nav tab, alongside the full wizard).
 * isAdmin is the ONLY thing that changes what's fetched/rendered - the
 * customer list is only ever fetched when true, so a non-admin session's
 * server-rendered payload never contains real customer data in the first
 * place, not just UI-hidden. */
export async function QuickQuoteScreen({ isAdmin }: { isAdmin: boolean }) {
  const ports = getPorts();
  const originPorts = ports.filter((p) => p.role !== "DESTINATION");
  const destinationPorts = ports.filter((p) => p.role !== "ORIGIN");

  const [salesReps, customers] = await Promise.all([
    getSalesReps(),
    isAdmin ? getCustomers() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16 print:py-0 print:px-0">
      <div className="no-print">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">빠른 견적조회</p>
        <h1 className="text-[28px] font-semibold tracking-tight mb-1">견적 조회</h1>
        <p className="text-[13px] text-[var(--muted)] mb-8">
          출발지와 도착지, 컨테이너 타입을 선택하면 견적을 체험해볼 수 있습니다.
        </p>
      </div>

      <PublicQuoteForm
        mode="quick"
        isAdmin={isAdmin}
        originPorts={originPorts}
        destinationPorts={destinationPorts}
        regions={getRegions()}
        containerTypes={getContainerTypes()}
        company={getCompany()}
        salesReps={salesReps}
        customers={customers}
      />
    </div>
  );
}
