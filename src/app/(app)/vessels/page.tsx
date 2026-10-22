import { VesselBoard } from "@/components/vessels/VesselBoard";
import { getCustomers, getPorts, getSalesReps, getVesselWatches } from "@/lib/data-store";
import { kstToday } from "@/lib/exchange-rate-history";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "선박 스케줄 | I.S. Sea & Air" };

export default async function VesselsPage() {
  const [watches, customers, salesReps] = await Promise.all([getVesselWatches(), getCustomers(), getSalesReps()]);
  const portNames = [...new Set(getPorts().map((p) => p.nameKo))];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 py-5 sm:py-10 lg:py-16">
      <div className="mb-4 sm:mb-6 animate-dashboard-fade-up">
        <p className="text-[12px] sm:text-[13px] font-medium text-[var(--accent)] mb-1 sm:mb-2">견적 관리</p>
        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight">선박 스케줄</h1>
        <p className="text-[12.5px] sm:text-[13px] text-[var(--muted)] mt-1">
          선박별 출항·입항일을 기록해 두면, 일정이 밀리거나 당겨질 때마다 변경 이력과 지연 일수를 보여줘요.
        </p>
      </div>
      <div className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <VesselBoard today={kstToday()} initialWatches={watches} customers={customers} salesReps={salesReps} portNames={portNames} />
      </div>
    </div>
  );
}
