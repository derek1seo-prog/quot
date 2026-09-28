"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/Field";
import { IncotermsSelect } from "./IncotermsSelect";
import { PortCombobox, type PortOption } from "./PortCombobox";
import { QuoteDocument } from "./QuoteDocument";
import type { CompanyInfo, ContainerType, Port, QuoteInput, QuoteResult, Region } from "@/lib/types";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TODAY = new Date().toISOString().slice(0, 10);

function endOfMonthIso(dateIso: string): string {
  const [year, month] = dateIso.split("-").map(Number);
  const lastDay = new Date(year, month, 0);
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(
    lastDay.getDate(),
  ).padStart(2, "0")}`;
}

/** Shared by /guest and /my - a single-screen (not the admin wizard's
 * multi-step) rate-lookup form. Reuses the same functional building blocks
 * as the admin wizard (PortCombobox, IncotermsSelect, QuoteDocument) but
 * never touches that file - guest/customer are a deliberately simpler,
 * separate flow so the existing admin wizard stays completely unchanged. */
export function PublicQuoteForm({
  mode,
  originPorts,
  destinationPorts,
  regions,
  containerTypes,
  company,
  lockedCustomer,
  preparedBy,
}: {
  mode: "guest" | "customer";
  originPorts: Port[];
  destinationPorts: Port[];
  regions: Region[];
  containerTypes: ContainerType[];
  company: CompanyInfo;
  lockedCustomer?: { name: string; contactName?: string };
  preparedBy?: string;
}) {
  const router = useRouter();
  const [originPortId, setOriginPortId] = useState("");
  const [destinationPortId, setDestinationPortId] = useState("");
  const [incoterms, setIncoterms] = useState("FOB");
  const [containerTypeId, setContainerTypeId] = useState(containerTypes[0]?.id ?? "");
  const [containerQuantity, setContainerQuantity] = useState(1);

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const polOptions: PortOption[] = useMemo(
    () =>
      regions.flatMap((region) => {
        const ports = originPorts.filter((p) => p.regionId === region.id);
        return ports.map((port) => ({ port, groupLabel: region.nameKo }));
      }),
    [originPorts, regions],
  );
  const podOptions: PortOption[] = useMemo(
    () => destinationPorts.map((port) => ({ port })),
    [destinationPorts],
  );

  const originPort = originPorts.find((p) => p.id === originPortId);
  const destinationPort = destinationPorts.find((p) => p.id === destinationPortId);

  function buildInput(): QuoteInput {
    return {
      customerName: lockedCustomer?.name ?? "",
      contactName: lockedCustomer?.contactName,
      preparedBy: preparedBy ?? "",
      quoteDate: TODAY,
      validUntil: endOfMonthIso(TODAY),
      transportMode: "FCL",
      originCountryId: originPort?.countryId ?? "",
      originPortId,
      destinationCountryId: destinationPort?.countryId ?? "",
      destinationPortId,
      incoterms,
      container: { containerTypeId, quantity: containerQuantity },
    };
  }

  const ready = Boolean(originPortId && destinationPortId && incoterms && containerTypeId);

  // Live preview - recalculates whenever the lookup conditions change,
  // rather than a separate "조회" button, so changing a condition reads
  // as adjusting a live quote rather than submitting a new query each time.
  useEffect(() => {
    if (!ready) {
      requestAnimationFrame(() => setResult(null));
      return;
    }
    let cancelled = false;
    requestAnimationFrame(() => {
      if (!cancelled) {
        setCalculating(true);
        setError(null);
      }
    });
    fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildInput()),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "계산에 실패했습니다.");
        setResult(data as QuoteResult);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "계산에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setCalculating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPortId, destinationPortId, incoterms, containerTypeId, containerQuantity]);

  async function handleIssue() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "견적서 발급에 실패했습니다.");
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 발급에 실패했습니다.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        {mode === "customer" && lockedCustomer && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6 pb-6 border-b border-[var(--border-subtle)]">
            <FieldGroup>
              <FieldLabel hint="고정">화주명</FieldLabel>
              <Input value={lockedCustomer.name} disabled />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="고정">견적 담당자</FieldLabel>
              <Input value={preparedBy ?? ""} disabled />
            </FieldGroup>
          </div>
        )}

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
            <IncotermsSelect value={incoterms} onChange={setIncoterms} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>컨테이너 타입</FieldLabel>
            <div className="flex gap-2">
              <Select
                value={containerTypeId}
                onChange={(e) => setContainerTypeId(e.target.value)}
                className="flex-1"
              >
                {containerTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.label}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                value={containerQuantity}
                onChange={(e) => setContainerQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 text-center"
              />
            </div>
          </FieldGroup>
        </div>
      </Card>

      {mode === "guest" && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--accent-soft)]">
          <Badge tone="accent">체험용</Badge>
          <p className="text-[13px] text-[var(--accent)]">
            체험용 견적입니다. 실제 견적은 상이할 수 있습니다.
          </p>
        </div>
      )}

      {calculating && (
        <div className="flex items-center justify-center gap-2 text-[var(--muted)] py-16">
          <Loader2 className="animate-spin" size={18} /> 견적을 계산하는 중...
        </div>
      )}

      {!calculating && error && (
        <Card className="p-8 text-center">
          <p className="text-[14px] text-[var(--danger)] font-medium">{error}</p>
        </Card>
      )}

      {!calculating && !error && result && (
        <>
          <QuoteDocument
            company={company}
            quoteNumber={null}
            input={buildInput()}
            result={result}
            originLabel={originPort ? `${originPort.nameKo} (${originPort.name})` : ""}
            destinationLabel={destinationPort ? `${destinationPort.nameKo} (${destinationPort.name})` : ""}
          />
          {mode === "customer" && (
            <div className="flex justify-end max-w-[900px] mx-auto">
              <Button
                onClick={handleIssue}
                disabled={saving}
                icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              >
                {saving ? "발급 중..." : "이 조건으로 견적서 발급"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
