import { LinkButton } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { QuoteCompareTable } from "@/components/portal/QuoteCompareTable";
import { getQuoteById } from "@/lib/data-store";
import { getSession } from "@/lib/auth/require";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default async function PortalComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "customer") redirect("/login");

  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean);

  const fetched = await Promise.all(idList.map((id) => getQuoteById(id)));
  // Defensive: silently drop anything that doesn't exist or doesn't belong
  // to this customer, rather than erroring on a tampered URL.
  const quotes = fetched.filter((q) => q && q.input.customerId === session.sub) as NonNullable<
    (typeof fetched)[number]
  >[];

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <LinkButton href="/portal" variant="ghost" size="sm" icon={<ArrowLeft size={15} />} className="mb-4">
        내 견적으로
      </LinkButton>
      <div className="mb-8">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">화주 포털</p>
        <h1 className="text-[28px] font-semibold tracking-tight">견적 비교</h1>
      </div>

      {quotes.length < 2 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium">비교할 견적을 2개 이상 선택해 주세요.</p>
            <LinkButton href="/portal" className="mx-auto mt-6">
              내 견적으로 돌아가기
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <QuoteCompareTable quotes={quotes} />
      )}
    </div>
  );
}
