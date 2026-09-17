"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/Field";
import { PortCombobox, type PortOption } from "@/components/quote/PortCombobox";
import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { Step, StepIndicator } from "@/components/quote/StepIndicator";
import type {
  ChargeRate,
  CompanyInfo,
  ContainerType,
  Customer,
  ExchangeRate,
  OceanFreightRate,
  Port,
  QuoteInput,
  QuoteResult,
  Region,
  TransportMode,
} from "@/lib/types";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface MetaResponse {
  regions: Region[];
  ports: Port[];
  containerTypes: ContainerType[];
  oceanFreightRates: OceanFreightRate[];
  chargeRates: ChargeRate[];
  exchangeRate: ExchangeRate;
  customers: Customer[];
}

const steps: Step[] = [
  { label: "출발지 선택" },
  { label: "컨테이너 선택" },
  { label: "기본 정보" },
  { label: "견적서 미리보기" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function endOfMonthIso(dateIso: string): string {
  const [year, month] = dateIso.split("-").map(Number);
  const lastDay = new Date(year, month, 0);
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${lastDay.getFullYear()}-${mm}-${dd}`;
}

export default function NewQuotePage() {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [step, setStep] = useState(0);

  // Step 1 - lane
  const [originPortId, setOriginPortId] = useState("");
  const [destinationPortId, setDestinationPortId] = useState("");
  const [incoterms, setIncoterms] = useState("FOB");
  const transportMode: TransportMode = "FCL";

  // Step 2 - container
  const [containerTypeId, setContainerTypeId] = useState("");
  const [containerQuantity, setContainerQuantity] = useState(1);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Step 3 - basic info
  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [preparedBy, setPreparedBy] = useState("김태현 대리");
  const [quoteDate, setQuoteDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(endOfMonthIso(todayIso()));
  const [hsCode, setHsCode] = useState("");
  const [remarks, setRemarks] = useState("");

  // Step 4 - calculation
  const [calcResult, setCalcResult] = useState<QuoteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((data: MetaResponse) => setMeta(data));
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCompany(c))
      .catch(() => setCompany(null));
  }, []);

  const originPorts = useMemo(
    () => (meta ? meta.ports.filter((p) => p.role !== "DESTINATION") : []),
    [meta],
  );
  const destinationPorts = useMemo(
    () => (meta ? meta.ports.filter((p) => p.role !== "ORIGIN") : []),
    [meta],
  );
  const portsByRegion = useMemo(() => {
    if (!meta) return [] as { region: Region; ports: Port[] }[];
    return meta.regions.map((region) => ({
      region,
      ports: originPorts.filter((p) => p.regionId === region.id),
    }));
  }, [meta, originPorts]);

  const polOptions: PortOption[] = useMemo(
    () =>
      portsByRegion.flatMap(({ region, ports }) =>
        ports.map((port) => ({ port, groupLabel: region.nameKo })),
      ),
    [portsByRegion],
  );
  const podOptions: PortOption[] = useMemo(
    () => destinationPorts.map((port) => ({ port })),
    [destinationPorts],
  );

  const originPort = meta?.ports.find((p) => p.id === originPortId);
  const destinationPort = meta?.ports.find((p) => p.id === destinationPortId);
  const matchedCustomer = meta?.customers.find((c) => c.name === customerName);

  function hasRateForContainer(containerTypeId: string) {
    if (!meta || !originPortId || !destinationPortId) return false;
    return meta.oceanFreightRates.some(
      (r) =>
        r.portId === originPortId &&
        r.destinationPortId === destinationPortId &&
        r.containerTypeId === containerTypeId,
    );
  }

  function buildInput(): QuoteInput {
    return {
      customerName,
      contactName,
      preparedBy,
      quoteDate,
      validUntil,
      transportMode,
      originCountryId: originPort?.countryId ?? "",
      originPortId,
      destinationCountryId: destinationPort?.countryId ?? "",
      destinationPortId,
      incoterms,
      hsCode,
      container: { containerTypeId, quantity: containerQuantity },
      remarks,
    };
  }

  async function runCalculation() {
    setCalculating(true);
    setCalcError(null);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "계산에 실패했습니다.");
      setCalcResult(data as QuoteResult);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "계산에 실패했습니다.");
    } finally {
      setCalculating(false);
    }
  }

  async function goToStep(next: number) {
    if (next === 3) {
      setStep(3);
      await runCalculation();
      return;
    }
    setStep(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했습니다.");
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setSaving(false);
    }
  }

  const step1Valid = Boolean(originPortId && destinationPortId && incoterms);
  const step2Valid = Boolean(containerTypeId);
  const step3Valid = Boolean(customerName && preparedBy && quoteDate && validUntil);

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-[var(--muted)] gap-2">
        <Loader2 className="animate-spin" size={18} /> 불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <p className="text-[13px] font-medium text-[var(--accent)] mb-2">새 견적 만들기</p>
      <h1 className="text-[28px] font-semibold tracking-tight mb-8">수출입 FCL 견적</h1>

      <StepIndicator steps={steps} current={step} />

      {step === 0 && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-[17px] font-semibold mb-1">출발지와 도착지를 선택하세요</h2>
          <p className="text-[13px] text-[var(--muted)] mb-6">
            출발항을 선택하면 해당 권역(북중국 또는 남중국)의 부대비용 구조가 자동으로 적용됩니다.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            <FieldGroup>
              <FieldLabel>출발항 (POL)</FieldLabel>
              <PortCombobox value={originPortId} onChange={setOriginPortId} options={polOptions} />
              {originPort && (
                <p className="text-[12px] text-[var(--muted)] mt-1.5">
                  적용 권역:{" "}
                  <span className="font-medium text-[var(--accent)]">
                    {meta.regions.find((r) => r.id === originPort.regionId)?.nameKo}
                  </span>
                </p>
              )}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel>도착항 (POD)</FieldLabel>
              <PortCombobox value={destinationPortId} onChange={setDestinationPortId} options={podOptions} />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel>선적 조건 (Incoterms)</FieldLabel>
              <Select value={incoterms} onChange={(e) => setIncoterms(e.target.value)}>
                {["FOB", "CIF", "EXW", "FCA", "CFR", "DAP", "DDP"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <FieldLabel>운송 방식</FieldLabel>
              <Select value={transportMode} disabled>
                <option value="FCL">FCL (Full Container Load)</option>
              </Select>
            </FieldGroup>
          </div>

          <div className="flex justify-end mt-8">
            <Button disabled={!step1Valid} onClick={() => goToStep(1)} icon={<ArrowRight size={16} />}>
              다음
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-[17px] font-semibold mb-1">컨테이너 타입을 선택하세요</h2>
          <p className="text-[13px] text-[var(--muted)] mb-6">
            견적에 포함할 컨테이너 타입과 수량을 선택합니다.
          </p>

          <div
            className={`grid gap-4 ${
              meta.containerTypes.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            {meta.containerTypes.map((ct) => {
              const selected = ct.id === containerTypeId;
              const rateAvailable = hasRateForContainer(ct.id);
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => {
                    setContainerTypeId(selected ? "" : ct.id);
                    if (!selected) {
                      requestAnimationFrame(() => quantityInputRef.current?.focus());
                    }
                  }}
                  className={`text-left p-5 rounded-[var(--radius-md)] border-2 transition-all ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] hover:border-[var(--foreground)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[18px] font-bold">{ct.label}</span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                      }`}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--muted)] mt-1">{ct.excelCode}</p>
                  {!rateAvailable && (
                    <p className="text-[11px] text-[var(--warning)] mt-2 flex items-center gap-1">
                      <AlertTriangle size={12} /> 이 출발항의 요율 미등록
                    </p>
                  )}
                  {selected && (
                    <div
                      className="mt-4 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[12px] text-[var(--muted)]">수량</span>
                      <input
                        ref={quantityInputRef}
                        type="number"
                        min={1}
                        value={containerQuantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setContainerQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 h-8 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 text-[13px] bg-white"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="secondary" onClick={() => setStep(0)} icon={<ArrowLeft size={16} />}>
              이전
            </Button>
            <Button disabled={!step2Valid} onClick={() => goToStep(2)} icon={<ArrowRight size={16} />}>
              다음
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-[17px] font-semibold mb-1">기본 정보를 입력하세요</h2>
          <p className="text-[13px] text-[var(--muted)] mb-6">
            고객에게 전달될 견적서에 표시되는 정보입니다.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            <FieldGroup>
              <FieldLabel>화주</FieldLabel>
              <Input
                list="customer-list"
                value={customerName}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomerName(value);
                  const matched = meta.customers.find((c) => c.name === value);
                  if (matched?.contactName) setContactName(matched.contactName);
                }}
                placeholder="예: 지더블유파트너스"
              />
              <datalist id="customer-list">
                {meta.customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
              {matchedCustomer && (
                <p className="text-[11px] text-[var(--accent)] mt-1.5">
                  ✓ 등록된 화주 정보가 연동되었습니다
                </p>
              )}
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="선택">담당자</FieldLabel>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예: 이신후 부장님" />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>견적 담당자 (발신)</FieldLabel>
              <Input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="본인 성함" />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="선택">HS CODE</FieldLabel>
              <Input value={hsCode} onChange={(e) => setHsCode(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>견적일</FieldLabel>
              <Input
                type="date"
                value={quoteDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuoteDate(next);
                  setValidUntil(endOfMonthIso(next));
                }}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>유효기간</FieldLabel>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </FieldGroup>
            <FieldGroup className="sm:col-span-2">
              <FieldLabel hint="선택">비고</FieldLabel>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="추가로 전달할 조건이 있다면 입력하세요." />
            </FieldGroup>
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="secondary" onClick={() => setStep(1)} icon={<ArrowLeft size={16} />}>
              이전
            </Button>
            <Button disabled={!step3Valid} onClick={() => goToStep(3)} icon={<ArrowRight size={16} />}>
              견적 계산하기
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div>
          {calculating && (
            <div className="flex items-center justify-center gap-2 text-[var(--muted)] py-20">
              <Loader2 className="animate-spin" size={18} /> 견적을 계산하는 중...
            </div>
          )}

          {!calculating && calcError && (
            <Card className="p-8 text-center">
              <p className="text-[14px] text-[var(--danger)] font-medium">{calcError}</p>
              <Button variant="secondary" className="mt-4 mx-auto" onClick={() => runCalculation()}>
                다시 계산
              </Button>
            </Card>
          )}

          {!calculating && !calcError && calcResult && company && (
            <>
              <QuoteDocument
                company={company}
                quoteNumber={null}
                input={buildInput()}
                result={calcResult}
                originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : ""}
                destinationLabel={
                  destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : ""
                }
              />

              <div className="flex justify-between mt-8 max-w-[900px] mx-auto">
                <Button variant="secondary" onClick={() => setStep(2)} icon={<ArrowLeft size={16} />}>
                  이전
                </Button>
                <Button onClick={handleSave} disabled={saving} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
                  {saving ? "저장 중..." : "견적 저장하고 보기"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
