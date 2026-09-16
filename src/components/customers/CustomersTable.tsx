"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { RateCell } from "@/components/rates/RateCell";
import type { Customer } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type NumberField =
  | "incheonTruckingRate20ft"
  | "incheonTruckingRate40hq"
  | "busanTruckingRate20ft"
  | "busanTruckingRate40hq";

// Column widths as percentages of the table (sums to 100) - table-fixed
// makes these exact regardless of content, so the two ports' columns stay
// identical width instead of the browser's auto layout redistributing
// space unevenly between them.
const nameColPct = 21;
const contactColPct = 14;
const rateColPct = 16; // x4 port/size columns = 64
const actionColWidth = 44; // px - fixed so the hover-delete column never grows past its button

/** Rate fields grouped by port - one heading per port instead of repeating
 * "인천항"/"부산항" in every column label, so the table reads at a glance
 * without needing every field spelled out in full. */
const PORT_GROUPS: { label: string; fields: { field: NumberField; sub: string }[] }[] = [
  {
    label: "인천",
    fields: [
      { field: "incheonTruckingRate20ft", sub: "20FT" },
      { field: "incheonTruckingRate40hq", sub: "40HQ" },
    ],
  },
  {
    label: "부산",
    fields: [
      { field: "busanTruckingRate20ft", sub: "20FT" },
      { field: "busanTruckingRate40hq", sub: "40HQ" },
    ],
  },
];

export function CustomersTable({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Native scrollbars are easy to miss on tablets (thin, auto-hiding), so the
  // table can look like it's just cut off with no way to see the rest. Track
  // scroll position ourselves and fade the edges in/out as an explicit cue.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [customers.length]);

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

  async function handleDelete(customer: Customer) {
    if (!confirm(`${customer.name} 화주를 삭제할까요?`)) return;
    setDeletingId(customer.id);
    try {
      await fetch(`/api/customers?id=${customer.id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    } finally {
      setDeletingId(null);
    }
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
      <div className="hidden sm:block relative">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full table-fixed text-left min-w-[760px]">
            <colgroup>
              <col style={{ width: `${nameColPct}%` }} />
              <col style={{ width: `${contactColPct}%` }} />
              {PORT_GROUPS.flatMap((group) => group.fields.map((f) => <col key={f.field} style={{ width: `${rateColPct}%` }} />))}
              <col style={{ width: `${actionColWidth}px` }} />
            </colgroup>
            <thead>
              <tr className="text-[12px] text-[var(--muted)] uppercase tracking-wide">
                <th rowSpan={2} className="px-4 py-3 font-medium align-bottom">
                  화주
                </th>
                <th rowSpan={2} className="px-3 py-3 font-medium align-bottom">
                  담당자
                </th>
                {PORT_GROUPS.map((group) => (
                  <th
                    key={group.label}
                    colSpan={2}
                    className="px-2 py-2 font-medium text-center whitespace-nowrap border-l border-[var(--border-subtle)]"
                  >
                    {group.label}
                  </th>
                ))}
                <th rowSpan={2} />
              </tr>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--muted)]">
                {PORT_GROUPS.flatMap((group) =>
                  group.fields.map((f, i) => (
                    <th
                      key={f.field}
                      className={`px-1.5 py-1.5 font-medium text-right whitespace-nowrap ${
                        i === 0 ? "border-l border-[var(--border-subtle)]" : ""
                      }`}
                    >
                      {f.sub}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-0 group">
                  <td className="px-4 py-3 text-[13.5px] font-medium align-middle">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{c.name}</span>
                      {c.incotermsDefault && <Badge tone="neutral">{c.incotermsDefault}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[13.5px] text-[var(--foreground)] align-middle truncate">
                    {c.contactName ?? "-"}
                  </td>
                  {PORT_GROUPS.flatMap((group) =>
                    group.fields.map((f, i) => (
                      <td
                        key={f.field}
                        className={`px-1.5 py-2 align-middle ${i === 0 ? "border-l border-[var(--border-subtle)]" : ""}`}
                      >
                        <RateCell
                          value={c[f.field] ?? null}
                          onSave={(v) => saveField(c.id, { [f.field]: v })}
                          placeholder="-"
                        />
                      </td>
                    )),
                  )}
                  <td className="px-2 align-middle text-right">
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
                      aria-label="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--surface)] to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--surface)] to-transparent" />
        )}
      </div>

      <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
        {customers.map((c) => (
          <div key={c.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[13.5px] font-medium text-[var(--foreground)]">{c.name}</p>
                {c.incotermsDefault && <Badge tone="neutral">{c.incotermsDefault}</Badge>}
              </div>
              <button
                onClick={() => handleDelete(c)}
                disabled={deletingId === c.id}
                className="w-8 h-8 -mr-2 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] active:bg-red-50 active:text-[var(--danger)]"
                aria-label="삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-1">{c.contactName ?? "-"}</p>

            <div className="mt-3 space-y-2.5">
              {PORT_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] text-[var(--muted)] uppercase tracking-wide mb-1.5">
                    {group.label} 내륙운송료
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.fields.map((f) => (
                      <div key={f.field}>
                        <span className="text-[11px] text-[var(--muted)]">{f.sub}</span>
                        <RateCell value={c[f.field] ?? null} onSave={(v) => saveField(c.id, { [f.field]: v })} />
                      </div>
                    ))}
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
