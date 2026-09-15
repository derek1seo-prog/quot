"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { RateCell } from "@/components/rates/RateCell";
import { TextCell } from "@/components/customers/TextCell";
import type { Customer } from "@/lib/types";
import { useState } from "react";

type NumberField =
  | "incheonTruckingRate20ft"
  | "incheonTruckingRate40hq"
  | "busanTruckingRate20ft"
  | "busanTruckingRate40hq";

const RATE_FIELDS: { field: NumberField; label: string }[] = [
  { field: "incheonTruckingRate20ft", label: "인천항 20FT" },
  { field: "incheonTruckingRate40hq", label: "인천항 40HQ" },
  { field: "busanTruckingRate20ft", label: "부산항 20FT" },
  { field: "busanTruckingRate40hq", label: "부산항 40HQ" },
];

export function CustomersTable({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);

  async function saveField(id: string, patch: Partial<Customer>) {
    const res = await fetch("/api/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) throw new Error("save failed");
    const updated = (await res.json()) as Customer;
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  if (customers.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-16 text-center text-[var(--muted)] text-[14px]">
          등록된 화주가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left min-w-[960px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
              <th className="px-6 py-3 font-medium">화주</th>
              <th className="px-4 py-3 font-medium">담당자</th>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium w-40">입고지</th>
              {RATE_FIELDS.map(({ field, label }) => (
                <th key={field} className="px-2 py-3 font-medium w-28 text-right">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-6 py-3 text-[13.5px] font-medium align-middle">
                  <div className="flex items-center gap-2">
                    {c.name}
                    {c.incotermsDefault && <Badge tone="neutral">{c.incotermsDefault}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13.5px] text-[var(--muted)] align-middle">
                  {c.contactName ?? "-"}
                </td>
                <td className="px-4 py-3 text-[13.5px] text-[var(--muted)] align-middle">
                  {c.email ?? "-"}
                </td>
                <td className="px-4 py-2 align-middle">
                  <TextCell
                    value={c.deliveryLocation ?? null}
                    onSave={(v) => saveField(c.id, { deliveryLocation: v })}
                  />
                </td>
                {RATE_FIELDS.map(({ field }) => (
                  <td key={field} className="px-2 py-2 align-middle">
                    <RateCell value={c[field] ?? null} onSave={(v) => saveField(c.id, { [field]: v })} />
                  </td>
                ))}
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

            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[var(--muted)] shrink-0">입고지</span>
                <div className="w-40">
                  <TextCell
                    value={c.deliveryLocation ?? null}
                    onSave={(v) => saveField(c.id, { deliveryLocation: v })}
                  />
                </div>
              </div>
              {RATE_FIELDS.map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--muted)] shrink-0">{label}</span>
                  <div className="w-32">
                    <RateCell value={c[field] ?? null} onSave={(v) => saveField(c.id, { [field]: v })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
