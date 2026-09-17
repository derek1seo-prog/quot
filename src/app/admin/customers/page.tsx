import { AddCustomerForm } from "@/components/customers/AddCustomerForm";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { getCustomers } from "@/lib/data-store";
import type { PublicCustomer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const rawCustomers = await getCustomers();
  // passwordHash must never reach a client, including the admin's own
  // browser - it would otherwise be embedded in this server component's
  // serialized props.
  const customers: PublicCustomer[] = rawCustomers.map((c) => {
    const { passwordHash, ...rest } = c;
    return { ...rest, hasLoginAccount: Boolean(c.loginId && passwordHash) };
  });

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
