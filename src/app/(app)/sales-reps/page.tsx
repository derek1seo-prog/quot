import { SalesRepsTable } from "@/components/sales-reps/SalesRepsTable";
import { getSalesReps } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function SalesRepsPage() {
  const salesReps = await getSalesReps();

  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <div className="mb-6 animate-dashboard-fade-up">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
        <h1 className="text-[28px] font-semibold tracking-tight">사원 관리</h1>
      </div>
      <div className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <SalesRepsTable initialSalesReps={salesReps} />
      </div>
    </div>
  );
}
