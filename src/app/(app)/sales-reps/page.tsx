import { AddSalesRepForm } from "@/components/sales-reps/AddSalesRepForm";
import { SalesRepsTable } from "@/components/sales-reps/SalesRepsTable";
import { getSalesReps } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function SalesRepsPage() {
  const salesReps = await getSalesReps();

  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="mb-6 animate-dashboard-fade-up">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
        <h1 className="text-[28px] font-semibold tracking-tight">사원관리</h1>
      </div>
      <div className="mb-8 animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <AddSalesRepForm />
      </div>

      <div className="animate-dashboard-fade-up" style={{ animationDelay: "160ms" }}>
        <SalesRepsTable initialSalesReps={salesReps} />
      </div>
    </div>
  );
}
