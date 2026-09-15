"use client";

import { RateCell } from "./RateCell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ChargeRate, ChargeType, Currency, ContainerType, OceanFreightRate, Port } from "@/lib/types";
import { useState } from "react";

interface Props {
  regionId: string;
  regionNameKo: string;
  ports: Port[];
  containerTypes: ContainerType[];
  chargeTypes: ChargeType[];
  initialOceanFreightRates: OceanFreightRate[];
  initialChargeRates: ChargeRate[];
}

export function RegionRatesEditor({
  regionId,
  regionNameKo,
  ports,
  containerTypes,
  chargeTypes,
  initialOceanFreightRates,
  initialChargeRates,
}: Props) {
  const [oceanFreightRates, setOceanFreightRates] = useState(initialOceanFreightRates);
  const [chargeRates, setChargeRates] = useState(initialChargeRates);

  function findOceanFreight(portId: string, containerTypeId: string) {
    return oceanFreightRates.find(
      (r) => r.portId === portId && r.containerTypeId === containerTypeId,
    );
  }

  async function saveOceanFreight(portId: string, containerTypeId: string, rate: number) {
    const res = await fetch("/api/rates/ocean-freight", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portId, containerTypeId, rate, currency: "USD" }),
    });
    if (!res.ok) throw new Error("save failed");
    const updated = (await res.json()) as OceanFreightRate;
    setOceanFreightRates((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  function findChargeRate(chargeTypeId: string, containerTypeId: string) {
    return chargeRates.find(
      (r) => r.chargeTypeId === chargeTypeId && r.containerTypeId === containerTypeId,
    );
  }

  async function saveChargeRate(
    chargeTypeId: string,
    containerTypeId: string,
    rate: number,
    currency: Currency,
  ) {
    const res = await fetch("/api/rates/charges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId, chargeTypeId, containerTypeId, rate, currency }),
    });
    if (!res.ok) throw new Error("save failed");
    const updated = (await res.json()) as ChargeRate;
    setChargeRates((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>기본 운임 (Ocean Freight)</CardTitle>
          <CardDescription>
            항구별 · 컨테이너 타입별 해상 운임 (USD). 셀을 클릭해 바로 수정하고, 포커스를 벗어나면 자동 저장됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13px]">
              <thead>
                <tr className="text-[12px] text-[var(--muted)] uppercase tracking-wide">
                  <th className="text-left py-2 pr-3 font-medium">항구</th>
                  {containerTypes.map((ct) => (
                    <th key={ct.id} className="text-right py-2 px-2 font-medium w-32">
                      {ct.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ports.map((port) => (
                  <tr key={port.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-[var(--foreground)]">{port.nameKo}</p>
                      <p className="text-[11px] text-[var(--muted)]">{port.name}</p>
                    </td>
                    {containerTypes.map((ct) => {
                      const existing = findOceanFreight(port.id, ct.id);
                      return (
                        <td key={ct.id} className="py-2 px-2">
                          <RateCell
                            value={existing?.rate ?? null}
                            onSave={(v) => saveOceanFreight(port.id, ct.id, v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {ports.map((port) => (
              <MobilePortRateCard
                key={port.id}
                port={port}
                containerTypes={containerTypes}
                findRate={findOceanFreight}
                onSave={saveOceanFreight}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{regionNameKo} 부대비용</CardTitle>
          <CardDescription>
            지역별 부대비용 및 공통 비용. USD 항목은 견적 계산 시 환율이 자동 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="text-[12px] text-[var(--muted)] uppercase tracking-wide">
                  <th className="text-left py-2 pr-3 font-medium">비용 항목</th>
                  <th className="text-left py-2 px-2 font-medium w-20">통화</th>
                  <th className="text-left py-2 px-2 font-medium w-20">단위</th>
                  {containerTypes.map((ct) => (
                    <th key={ct.id} className="text-right py-2 px-2 font-medium w-32">
                      {ct.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chargeTypes.map((chargeType) => {
                  const sampleRate = findChargeRate(chargeType.id, containerTypes[0]?.id ?? "");
                  const currency = sampleRate?.currency ?? "KRW";
                  return (
                    <tr key={chargeType.id} className="border-t border-[var(--border-subtle)]">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-[var(--foreground)]">{chargeType.nameKo}</p>
                        <p className="text-[11px] text-[var(--muted)]">{chargeType.name}</p>
                      </td>
                      <td className="py-2 px-2 text-[var(--muted)]">{currency}</td>
                      <td className="py-2 px-2">
                        <Badge tone="neutral">{chargeType.unit === "BL" ? "B/L당" : "컨테이너당"}</Badge>
                      </td>
                      {containerTypes.map((ct) => {
                        const existing = findChargeRate(chargeType.id, ct.id);
                        return (
                          <td key={ct.id} className="py-2 px-2">
                            <RateCell
                              value={existing?.rate ?? null}
                              onSave={(v) =>
                                saveChargeRate(chargeType.id, ct.id, v, existing?.currency ?? currency)
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {chargeTypes.map((chargeType) => (
              <MobileChargeRateCard
                key={chargeType.id}
                chargeType={chargeType}
                containerTypes={containerTypes}
                findRate={findChargeRate}
                onSave={saveChargeRate}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Mobile (< sm) equivalent of the ocean freight table: one card per port,
 * each container type as its own editable row, using the exact same
 * RateCell + save callback the table uses - just laid out vertically
 * instead of as columns. */
function MobilePortRateCard({
  port,
  containerTypes,
  findRate,
  onSave,
}: {
  port: Port;
  containerTypes: ContainerType[];
  findRate: (portId: string, containerTypeId: string) => OceanFreightRate | undefined;
  onSave: (portId: string, containerTypeId: string, rate: number) => Promise<void>;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
      <p className="font-medium text-[var(--foreground)] text-[14px]">{port.nameKo}</p>
      <p className="text-[11px] text-[var(--muted)]">{port.name}</p>
      <div className="mt-3 space-y-2.5">
        {containerTypes.map((ct) => {
          const existing = findRate(port.id, ct.id);
          return (
            <div key={ct.id} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[var(--muted)] shrink-0">{ct.label}</span>
              <div className="w-32">
                <RateCell value={existing?.rate ?? null} onSave={(v) => onSave(port.id, ct.id, v)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile equivalent of the charges table: one card per charge type,
 * currency/unit shown as badges (matching the table row), then each
 * container type as its own editable row. */
function MobileChargeRateCard({
  chargeType,
  containerTypes,
  findRate,
  onSave,
}: {
  chargeType: ChargeType;
  containerTypes: ContainerType[];
  findRate: (chargeTypeId: string, containerTypeId: string) => ChargeRate | undefined;
  onSave: (
    chargeTypeId: string,
    containerTypeId: string,
    rate: number,
    currency: Currency,
  ) => Promise<void>;
}) {
  const sampleRate = findRate(chargeType.id, containerTypes[0]?.id ?? "");
  const currency = sampleRate?.currency ?? "KRW";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--foreground)] text-[14px]">{chargeType.nameKo}</p>
          <p className="text-[11px] text-[var(--muted)]">{chargeType.name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge tone="neutral">{currency}</Badge>
          <Badge tone="neutral">{chargeType.unit === "BL" ? "B/L당" : "컨테이너당"}</Badge>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {containerTypes.map((ct) => {
          const existing = findRate(chargeType.id, ct.id);
          return (
            <div key={ct.id} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[var(--muted)] shrink-0">{ct.label}</span>
              <div className="w-32">
                <RateCell
                  value={existing?.rate ?? null}
                  onSave={(v) => onSave(chargeType.id, ct.id, v, existing?.currency ?? currency)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
