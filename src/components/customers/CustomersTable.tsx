"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Customer, SalesRep } from "@/lib/types";
import { Building2, Check, Contact, Link2, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomerDialog, TRUCKING_PORTS, type CustomerDraft } from "./CustomerDialog";

/** 화주 관리 list: one row per customer (name, 담당자, 견적 담당자, 내륙운송료
 * at a glance) with link copy / 수정 / 삭제 always reachable. Adding and
 * editing go through CustomerDialog. */
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
      [c.name, c.contactName, c.phone, c.salesRepId ? repName.get(c.salesRepId) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-[320px]">
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
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-auto">
          <p className="text-[13px] text-[var(--muted)]">
            {query.trim() ? (
              <>
                {customers.length}곳 중 <span className="font-medium text-[var(--foreground)]">{visible.length}</span>곳
              </>
            ) : (
              <>
                총 <span className="font-medium text-[var(--foreground)]">{customers.length}</span>곳
              </>
            )}
          </p>
          <Button icon={<Plus size={16} />} onClick={() => setDialog({ customer: null })}>
            화주 추가
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState title="등록된 화주가 없습니다." description="화주를 추가하면 견적 작성 시 정보가 자동으로 연동됩니다." />
        ) : visible.length === 0 ? (
          <EmptyState title="검색 결과가 없습니다." description="화주명이나 담당자 이름으로 다시 검색해 보세요." />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {visible.map((c) => {
              const rep = c.salesRepId ? repName.get(c.salesRepId) : undefined;
              const portRates = TRUCKING_PORTS.map((p) => ({
                label: p.label.replace("항", ""),
                values: p.fields.map((f) => c[f.field]),
              })).filter((p) => p.values.some((v) => v != null));
              return (
                <li
                  key={c.id}
                  className={cn(
                    "group flex items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition-colors duration-700",
                    flashId === c.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--sidebar-bg)]/50",
                  )}
                >
                  <Avatar name={c.name} size="sm" />

                  <div className="min-w-0 flex-1 grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,1.4fr)] lg:items-center lg:gap-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[14px] font-semibold text-[var(--foreground)] truncate">{c.name}</p>
                        {c.incotermsDefault && (
                          <span className="shrink-0 rounded-full bg-[var(--sidebar-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--muted)]">
                            {c.incotermsDefault}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--muted)]">
                        <span>{c.contactName || "담당자 미등록"}</span>
                        {c.phone && (
                          <a
                            href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                            className="inline-flex items-center gap-1 tabular-nums hover:text-[var(--accent)]"
                          >
                            <Phone size={11} />
                            {c.phone}
                          </a>
                        )}
                      </p>
                    </div>

                    <div>
                      {rep ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] font-medium text-[var(--accent)]">
                          <Contact size={12} />
                          {rep}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--muted)]">
                          <Contact size={12} />
                          견적 담당자 미지정
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {portRates.length === 0 ? (
                        <span className="text-[12px] text-[var(--muted)]">내륙운송료 미등록</span>
                      ) : (
                        portRates.map((p) => (
                          <span
                            key={p.label}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white px-2 py-1 text-[11.5px]"
                            title="20FT / 40HQ (KRW)"
                          >
                            <span className="font-medium text-[var(--muted)]">{p.label}</span>
                            <span className="tabular-nums text-[var(--foreground)]">
                              {p.values.map((v) => (v != null ? formatNumber(v) : "-")).join(" / ")}
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* TEMPORARY: 화주 전용 링크 is still being finished - same
                        "업데이트 중" hover bubble as PDF 다운로드 (QuoteActions), shown to the
                        left since the overflow-hidden card would clip one above the first row. */}
                    <span className="relative inline-flex group/link">
                      <button
                        type="button"
                        onClick={() => copyAccessLink(c)}
                        disabled={!c.accessToken}
                        aria-label={`${c.name} 전용 링크 복사`}
                        className={cn(
                          "h-8 px-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12.5px] font-medium transition-colors disabled:opacity-30",
                          copiedId === c.id
                            ? "text-[var(--success)]"
                            : "text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]",
                        )}
                      >
                        {copiedId === c.id ? <Check size={14} /> : <Link2 size={14} />}
                        <span className="hidden md:inline">{copiedId === c.id ? "복사됨" : "링크"}</span>
                      </button>
                      {copiedId !== c.id && (
                        <span
                          className={cn(
                            TOOLTIP_BUBBLE_CLASS,
                            "pointer-events-none absolute right-full top-1/2 -translate-y-1/2 translate-x-1 mr-1.5 z-50 opacity-0 transition-all duration-200 group-hover/link:opacity-100 group-hover/link:translate-x-0 motion-reduce:transition-none",
                          )}
                        >
                          업데이트 중
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDialog({ customer: c })}
                      aria-label={`${c.name} 수정`}
                      className="h-8 px-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <Pencil size={14} />
                      <span className="hidden md:inline">수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      disabled={deletingId === c.id}
                      aria-label={`${c.name} 삭제`}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

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
