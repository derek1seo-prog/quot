import { PublicQuoteForm } from "@/components/quote/PublicQuoteForm";
import { Card, CardContent } from "@/components/ui/Card";
import {
  getCompany,
  getContainerTypes,
  getCustomerById,
  getPorts,
  getQuotes,
  getRegions,
  getSalesRepById,
} from "@/lib/data-store";
import { DEFAULT_SALES_REP_FALLBACK_NAME, DEFAULT_SALES_REP_ID } from "@/lib/customer-portal";
import { formatCurrency, formatDate } from "@/lib/format";
import { decodeSessionCookie } from "@/lib/session";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MyQuotesPage() {
  const session = decodeSessionCookie(await cookies());
  const customer = session?.role === "customer" && session.customerId
    ? await getCustomerById(session.customerId)
    : undefined;
  // Shouldn't happen (proxy.ts only grants a customer session from a valid
  // access-link match), but a customer record could be deleted after the
  // link was issued - fail back to needing a fresh link rather than
  // rendering a broken page.
  if (!customer) redirect("/unlock");

  const ports = getPorts();
  const originPorts = ports.filter((p) => p.role !== "DESTINATION");
  const destinationPorts = ports.filter((p) => p.role !== "ORIGIN");
  const portNameById = Object.fromEntries(ports.map((p) => [p.id, p.nameKo]));

  const allQuotes = await getQuotes();
  const myQuotes = allQuotes.filter((q) => q.input.customerId === customer.id);

  const defaultRep = await getSalesRepById(DEFAULT_SALES_REP_ID);

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <p className="text-[13px] font-medium text-[var(--accent)] mb-2">{customer.name}</p>
      <h1 className="text-[28px] font-semibold tracking-tight mb-1">견적 조회</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">
        조건을 선택하면 귀사에 적용되는 운임으로 견적을 바로 확인할 수 있습니다.
      </p>

      <PublicQuoteForm
        mode="customer"
        originPorts={originPorts}
        destinationPorts={destinationPorts}
        regions={getRegions()}
        containerTypes={getContainerTypes()}
        company={getCompany()}
        lockedCustomer={{ name: customer.name, contactName: customer.contactName }}
        preparedBy={defaultRep?.name ?? DEFAULT_SALES_REP_FALLBACK_NAME}
        preparedByEmail={defaultRep?.email}
        preparedByPhone={defaultRep?.phone}
      />

      <h2 className="text-[19px] font-semibold tracking-tight text-[var(--foreground)] mt-12 mb-4">
        내 견적
      </h2>
      <Card className="overflow-hidden">
        {myQuotes.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium text-[var(--foreground)]">
              발급된 견적이 아직 없습니다.
            </p>
            <p className="text-[13px] text-[var(--muted)] mt-1">
              위에서 조건을 선택하고 견적서를 발급해보세요.
            </p>
          </CardContent>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {myQuotes.map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-[var(--sidebar-bg)]/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[var(--accent)]">{q.quoteNumber}</p>
                  <p className="text-[12px] text-[var(--muted)] mt-0.5">
                    {portNameById[q.input.originPortId] ?? q.input.originPortId} →{" "}
                    {portNameById[q.input.destinationPortId] ?? q.input.destinationPortId} ·{" "}
                    {q.input.incoterms} · {formatDate(q.input.quoteDate)}
                  </p>
                </div>
                <p className="text-[13.5px] font-semibold text-[var(--foreground)] whitespace-nowrap">
                  {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
