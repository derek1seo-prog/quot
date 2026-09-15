import { AddCustomerForm } from "@/components/customers/AddCustomerForm";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { getCustomers } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="mb-6">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
        <h1 className="text-[28px] font-semibold tracking-tight">화주 관리</h1>
      </div>
      <div className="mb-8">
        <AddCustomerForm />
      </div>

      <CustomersTable initialCustomers={customers} />
    </div>
  );
}
