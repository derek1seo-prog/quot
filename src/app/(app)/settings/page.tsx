import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExchangeRateEditor } from "@/components/rates/ExchangeRateEditor";
import { getCompany, getCurrentExchangeRate } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const company = getCompany();
  const exchangeRate = getCurrentExchangeRate("USD");

  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-10 py-10 lg:py-14 space-y-8">
      <div>
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">설정</p>
        <h1 className="text-[28px] font-semibold tracking-tight">설정</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>환율</CardTitle>
          <CardDescription>
            견적 계산에 사용되는 기준 환율입니다. 모든 USD 항목은 이 환율로 원화 환산됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exchangeRate ? (
            <ExchangeRateEditor initial={exchangeRate} />
          ) : (
            <p className="text-[13px] text-[var(--muted)]">환율이 설정되어 있지 않습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>회사 정보</CardTitle>
          <CardDescription>견적서 상단에 표시되는 발신 회사 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid sm:grid-cols-2 gap-4 text-[13.5px]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">회사명</dt>
              <dd className="mt-0.5 font-medium">{company.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">전화 / 팩스</dt>
              <dd className="mt-0.5">
                {company.tel} {company.fax ? `/ ${company.fax}` : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">주소</dt>
              <dd className="mt-0.5">{company.addressLines.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">이메일</dt>
              <dd className="mt-0.5">{company.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium">웹사이트</dt>
              <dd className="mt-0.5">{company.website}</dd>
            </div>
          </dl>
          <p className="text-[12px] text-[var(--muted)] mt-4">
            회사 정보 수정 기능은 다음 버전에서 지원될 예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
