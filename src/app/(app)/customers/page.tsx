import { AddCustomerForm } from "@/components/customers/AddCustomerForm";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getCustomers } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">관리</p>
          <h1 className="text-[28px] font-semibold tracking-tight">고객 관리</h1>
        </div>
        <AddCustomerForm />
      </div>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <CardContent className="py-16 text-center text-[var(--muted)] text-[14px]">
            등록된 고객이 없습니다.
          </CardContent>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">고객명</th>
                <th className="px-6 py-3 font-medium">담당자</th>
                <th className="px-6 py-3 font-medium">이메일</th>
                <th className="px-6 py-3 font-medium">기본 Incoterms</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-6 py-4 text-[13.5px] font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)]">{c.contactName ?? "-"}</td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)]">{c.email ?? "-"}</td>
                  <td className="px-6 py-4 text-[13.5px] text-[var(--muted)]">
                    {c.incotermsDefault ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
            {customers.map((c) => (
              <div key={c.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-[var(--foreground)]">{c.name}</p>
                  {c.incotermsDefault && <Badge tone="neutral">{c.incotermsDefault}</Badge>}
                </div>
                <p className="text-[12px] text-[var(--muted)] mt-1">
                  {c.contactName ?? "-"} · {c.email ?? "-"}
                </p>
              </div>
            ))}
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
