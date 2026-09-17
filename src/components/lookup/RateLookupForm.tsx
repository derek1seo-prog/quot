"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Select } from "@/components/ui/Field";
import { PortCombobox, type PortOption } from "@/components/quote/PortCombobox";
import { QuoteDocument } from "@/components/quote/QuoteDocument";
import type { CompanyInfo, ContainerType, Port, QuoteResult, Region } from "@/lib/types";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface PublicMetaResponse {
  regions: Region[];
  ports: Port[];
  containerTypes: ContainerType[];
}

export function RateLookupForm() {
  const [meta, setMeta] = useState<PublicMetaResponse | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [originPortId, setOriginPortId] = useState("");
  const [destinationPortId, setDestinationPortId] = useState("");
  const [incoterms, setIncoterms] = useState("FOB");
  const [containerTypeId, setContainerTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);

  useEffect(() => {
    fetch("/api/meta/public")
      .then((r) => r.json())
      .then((data: PublicMetaResponse) => setMeta(data));
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCompany(c))
      .catch(() => setCompany(null));
  }, []);

  const originPorts = useMemo(() => (meta ? meta.ports.filter((p) => p.role !== "DESTINATION") : []), [meta]);
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
    () => portsByRegion.flatMap(({ region, ports }) => ports.map((port) => ({ port, groupLabel: region.nameKo }))),
    [portsByRegion],
  );
  const podOptions: PortOption[] = useMemo(() => destinationPorts.map((port) => ({ port })), [destinationPorts]);

  const originPort = meta?.ports.find((p) => p.id === originPortId);
  const destinationPort = meta?.ports.find((p) => p.id === destinationPortId);

  const formValid = Boolean(originPortId && destinationPortId && containerTypeId);

  async function handleLookup() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transportMode: "FCL",
          originPortId,
          destinationPortId,
          incoterms,
          container: { containerTypeId, quantity },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회에 실패했습니다.");
      setResult(data.result as QuoteResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!meta) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--muted)] gap-2">
        <Loader2 className="animate-spin" size={18} /> 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <h2 className="text-[17px] font-semibold mb-1">운임 조회</h2>
        <p className="text-[13px] text-[var(--muted)] mb-6">
          출발항과 도착항, 컨테이너 정보를 입력하면 전체 항목이 포함된 예상 운임을 확인할 수 있습니다.
        </p>
        <div className="grid sm:grid-cols-2 gap-6">
          <FieldGroup>
            <FieldLabel>출발항 (POL)</FieldLabel>
            <PortCombobox value={originPortId} onChange={setOriginPortId} options={polOptions} />
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
            <FieldLabel>컨테이너 타입</FieldLabel>
            <Select value={containerTypeId} onChange={(e) => setContainerTypeId(e.target.value)}>
              <option value="">선택하세요</option>
              {meta.containerTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>수량</FieldLabel>
            <input
              type="number"
              min={1}
              value={quantity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[14px] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </FieldGroup>
        </div>
        <div className="flex justify-end mt-8">
          <Button disabled={!formValid || loading} onClick={handleLookup} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? "조회 중..." : "조회하기"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-6 text-center">
          <p className="text-[14px] text-[var(--danger)] font-medium flex items-center justify-center gap-2">
            <AlertTriangle size={16} /> {error}
          </p>
        </Card>
      )}

      {result && company && (
        <div className="animate-step-in-forward">
          <QuoteDocument
            company={company}
            quoteNumber={null}
            input={{
              customerId: undefined,
              customerName: "",
              preparedBy: "",
              quoteDate: new Date().toISOString().slice(0, 10),
              validUntil: new Date().toISOString().slice(0, 10),
              transportMode: "FCL",
              originCountryId: "",
              originPortId,
              destinationCountryId: "",
              destinationPortId,
              incoterms,
              container: { containerTypeId, quantity },
            }}
            result={result}
            originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : ""}
            destinationLabel={destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : ""}
            variant="lookup"
          />
        </div>
      )}
    </div>
  );
}
