import { CustomersTable } from "@/components/customers/CustomersTable";
import { getCustomers, getSalesReps } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, salesReps] = await Promise.all([getCustomers(), getSalesReps()]);

  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <div className="mb-6 animate-dashboard-fade-up">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
        <h1 className="text-[28px] font-semibold tracking-tight">화주 관리</h1>
      </div>
      <div className="animate-dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <CustomersTable initialCustomers={customers} salesReps={salesReps} />
      </div>
    </div>
  );
}
