import { Card, CardContent } from "@/components/ui/Card";
import { PortalQuoteList } from "@/components/portal/PortalQuoteList";
import { getPorts, getQuotesByCustomerId } from "@/lib/data-store";
import { getSession } from "@/lib/auth/require";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const session = await getSession();
  if (session?.role !== "customer") redirect("/login");

  const quotes = await getQuotesByCustomerId(session.sub);
  const portNameById = Object.fromEntries(getPorts().map((p) => [p.id, p.nameKo]));

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">화주 포털</p>
        <h1 className="text-[28px] font-semibold tracking-tight">내 견적</h1>
        <p className="text-[13px] text-[var(--muted)] mt-2">{session.customerName}님께 발급된 견적 목록입니다.</p>
      </div>

      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <CardContent className="py-16 text-center">
            <p className="text-[15px] font-medium">아직 발급된 견적이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">담당자에게 문의해 주세요.</p>
          </CardContent>
        ) : (
          <div className="p-4 sm:p-2">
            <PortalQuoteList quotes={quotes} portNameById={portNameById} />
          </div>
        )}
      </Card>
    </div>
  );
}
