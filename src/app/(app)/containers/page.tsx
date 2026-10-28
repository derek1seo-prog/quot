import { ContainerBoard } from "@/components/containers/ContainerBoard";
import { getContainers, getCustomers, getPorts, getSalesReps, getVesselWatches } from "@/lib/data-store";
import { kstToday } from "@/lib/exchange-rate-history";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "컨테이너 현황 | I.S. Sea & Air" };

export default async function ContainersPage() {
  const [containers, vessels, customers, salesReps] = await Promise.all([
    getContainers(),
    getVesselWatches(),
    getCustomers(),
    getSalesReps(),
  ]);
  const portNames = [...new Set(getPorts().map((p) => p.nameKo))];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-5 sm:py-10 lg:py-14">
      <div className="mb-4 sm:mb-6 animate-dashboard-fade-up">
        <p className="text-[12px] sm:text-[13px] font-medium text-[var(--accent)] mb-1 sm:mb-2">운송 관리</p>
        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight">컨테이너 현황</h1>
        <p className="text-[12.5px] sm:text-[13px] text-[var(--muted)] mt-1">
          출항 확인부터 배차·프리타임·서렌더·정산까지, 담당 컨테이너의 진행 단계를 한눈에 챙겨요.
        </p>
      </div>
      <div className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <ContainerBoard
          today={kstToday()}
          initialContainers={containers}
          initialVessels={vessels}
          customers={customers}
          salesReps={salesReps}
          portNames={portNames}
        />
      </div>
    </div>
  );
}
