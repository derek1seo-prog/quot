"use client";

import { MonoAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconAction } from "@/components/ui/IconAction";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { matchesSearch } from "@/lib/hangul";
import type { Customer, SalesRep } from "@/lib/types";
import { Building2, Check, Link2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomerDialog, TRUCKING_PORTS, type CustomerDraft } from "./CustomerDialog";

/** 화주 관리 list (same look as 사원 관리): headcount + search, then a
 * table-like list - 화주 (담당자 · 연락처), 견적 담당자, and 내륙운송료 per
 * port - with quiet icon actions. Adding and editing go through
 * CustomerDialog. */
export function CustomersTable({
  initialCustomers,
  salesReps,
}: {
  initialCustomers: Customer[];
  salesReps: SalesRep[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ customer: Customer | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // initialCustomers is a fresh array from the server component on every
  // router.refresh() - adjust state during render per React's guidance.
  const [prevInitialCustomers, setPrevInitialCustomers] = useState(initialCustomers);
  if (initialCustomers !== prevInitialCustomers) {
    setPrevInitialCustomers(initialCustomers);
    setCustomers(initialCustomers);
  }

  const repName = useMemo(() => new Map(salesReps.map((r) => [r.id, r.name])), [salesReps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      matchesSearch(
        [c.name, c.contactName, c.phone, c.salesRepId ? repName.get(c.salesRepId) : ""].filter(Boolean).join(" "),
        q,
      ),
    );
  }, [customers, query, repName]);

  function flash(id: string) {
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  async function handleSubmit(draft: CustomerDraft) {
    const editing = dialog?.customer;
    const rates = Object.fromEntries(
      Object.entries(draft.rates).map(([k, v]) => [k, v === "" ? null : Number(v)]),
    );
    const body = {
      name: draft.name,
      contactName: draft.contactName.trim() || null,
      phone: draft.phone.trim() || null,
      salesRepId: draft.salesRepId || null,
      ...rates,
    };
    const res = await fetch("/api/customers", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...body } : body),
    });
    if (!res.ok) throw new Error("save failed");
    const saved = (await res.json()) as Customer;
    setCustomers((prev) => (editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]));
    setDialog(null);
    flash(saved.id);
  }

  async function copyAccessLink(customer: Customer) {
    if (!customer.accessToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/c/${customer.accessToken}`);
    setCopiedId(customer.id);
    setTimeout(() => setCopiedId((id) => (id === customer.id ? null : id)), 1500);
  }

  async function confirmDelete() {
    const customer = pendingDelete;
    if (!customer) return;
    setDeletingId(customer.id);
    try {
      await fetch(`/api/customers?id=${customer.id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11.5px] font-medium tracking-wide text-[var(--muted)]">등록 화주</p>
          <p className="mt-0.5 text-[26px] leading-none font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
            {query.trim() ? visible.length : customers.length}
            <span className="ml-1 text-[14px] font-medium text-[var(--muted)]">
              곳{query.trim() ? ` / ${customers.length}곳` : ""}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-[260px]">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="화주명·담당자 검색"
              aria-label="화주 검색"
              className="pl-9"
            />
          </div>
          <Button icon={<Plus size={16} />} onClick={() => setDialog({ customer: null })} className="shrink-0">
            화주 추가
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
        {customers.length === 0 ? (
          <EmptyState title="등록된 화주가 없습니다." description="화주를 추가하면 견적 작성 시 정보가 자동으로 연동됩니다." />
        ) : visible.length === 0 ? (
          <EmptyState title="검색 결과가 없습니다." description="화주명이나 담당자 이름으로 다시 검색해 보세요." />
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,0.95fr)_repeat(3,minmax(0,0.5fr))_112px] gap-4 px-6 py-3 border-b border-[var(--border-subtle)] text-[11px] font-medium tracking-wide text-[var(--muted)]">
              <span>화주</span>
              <span>견적 담당자</span>
              {TRUCKING_PORTS.map((p) => (
                <span key={p.label} className="text-right">
                  {p.label.replace("항", "")}
                  <span className="block whitespace-nowrap tracking-normal text-[10px] font-normal text-[#94a3b8]">20FT·40HQ</span>
                </span>
              ))}
              <span />
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {visible.map((c) => {
                const rep = c.salesRepId ? repName.get(c.salesRepId) : undefined;
                const hasRates = TRUCKING_PORTS.some((p) => p.fields.some((f) => c[f.field] != null));
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,0.95fr)_repeat(3,minmax(0,0.5fr))_112px] items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-4 transition-colors duration-700 first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]",
                      flashId === c.id ? "bg-[var(--accent-soft)]" : "hover:bg-[#f8fafc]",
                    )}
                  >
                    {/* 화주 */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <MonoAvatar name={c.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)] truncate">
                            {c.name}
                          </p>
                          {c.incotermsDefault && (
                            <span className="shrink-0 rounded-[6px] bg-[var(--sidebar-bg)] px-1.5 py-[1px] text-[11px] font-medium text-[var(--muted)]">
                              {c.incotermsDefault}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-2 min-w-0 text-[12.5px] text-[var(--muted)]">
                          <span className="truncate">{c.contactName || "담당자 미등록"}</span>
                          {c.phone && (
                            <>
                              <span className="text-[#cbd5e1]">·</span>
                              <a
                                href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                                className="shrink-0 tabular-nums hover:text-[var(--accent)]"
                              >
                                {c.phone}
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* 견적 담당자 */}
                    <div className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto pl-[54px] sm:pl-0 min-w-0">
                      {rep ? (
                        <span className="inline-flex items-center gap-2 min-w-0 text-[13px] text-[#334155]">
                          <MonoAvatar name={rep} size="xs" />
                          <span className="truncate">{rep}</span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[#94a3b8]">미지정</span>
                      )}
                    </div>

                    {/* 내륙운송료 - one column per port on desktop */}
                    {TRUCKING_PORTS.map((p) => (
                      <div key={p.label} className="hidden sm:block text-right tabular-nums text-[12.5px] leading-[1.45]">
                        {p.fields.map((f) => (
                          <p key={f.field} className={c[f.field] != null ? "text-[#334155]" : "text-[#cbd5e1]"}>
                            {c[f.field] != null ? formatNumber(c[f.field] as number) : "—"}
                          </p>
                        ))}
                      </div>
                    ))}
                    {/* ...and a compact summary line on mobile */}
                    <p className="sm:hidden col-span-2 pl-[54px] text-[12px] text-[var(--muted)] tabular-nums">
                      {hasRates
                        ? TRUCKING_PORTS.filter((p) => p.fields.some((f) => c[f.field] != null))
                            .map(
                              (p) =>
                                `${p.label.replace("항", "")} ${p.fields
                                  .map((f) => (c[f.field] != null ? formatNumber(c[f.field] as number) : "-"))
                                  .join("/")}`,
                            )
                            .join(" · ")
                        : "내륙운송료 미등록"}
                    </p>

                    {/* actions */}
                    <div className="flex items-center justify-end gap-0.5 col-start-2 sm:col-start-auto row-start-1 sm:row-start-auto">
                      <IconAction
                        label={`${c.name} 전용 링크 복사`}
                        tooltip={copiedId === c.id ? "복사됨" : "업데이트 중"}
                        onClick={() => copyAccessLink(c)}
                        disabled={!c.accessToken}
                        hoverClass="hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                        className={copiedId === c.id ? "text-[var(--success)]" : undefined}
                      >
                        {copiedId === c.id ? <Check size={15} /> : <Link2 size={15} />}
                      </IconAction>
                      <IconAction label={`${c.name} 수정`} tooltip="수정" onClick={() => setDialog({ customer: c })}>
                        <Pencil size={15} />
                      </IconAction>
                      <IconAction
                        label={`${c.name} 삭제`}
                        tooltip="삭제"
                        onClick={() => setPendingDelete(c)}
                        disabled={deletingId === c.id}
                        hoverClass="hover:text-[var(--danger)] hover:bg-red-50"
                        reveal
                      >
                        <Trash2 size={15} />
                      </IconAction>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <CustomerDialog
        open={dialog != null}
        customer={dialog?.customer ?? null}
        salesReps={salesReps}
        existingNames={customers.filter((c) => c.id !== dialog?.customer?.id).map((c) => c.name)}
        onClose={() => setDialog(null)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title="화주를 삭제할까요?"
        description={
          pendingDelete
            ? `${pendingDelete.name} 화주 정보와 등록된 내륙운송료가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            : undefined
        }
        loading={deletingId != null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-16 text-center">
      <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center text-[var(--muted)]">
        <Building2 size={20} />
      </span>
      <p className="text-[14px] font-medium">{title}</p>
      <p className="text-[13px] text-[var(--muted)] mt-1">{description}</p>
    </div>
  );
}
