"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DEFAULT_SALES_REP_ID } from "@/lib/customer-portal";
import { cn } from "@/lib/cn";
import type { SalesRep } from "@/lib/types";
import { Mail, Pencil, Phone, Plus, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Avatar, SalesRepDialog, type SalesRepDraft } from "./SalesRepDialog";

/** 사원 관리 list: one row per rep (avatar, name, contact), with 수정 / 삭제
 * always reachable (desktop and touch alike). Adding and editing both go
 * through SalesRepDialog instead of inline table inputs. */
export function SalesRepsTable({ initialSalesReps }: { initialSalesReps: SalesRep[] }) {
  const [salesReps, setSalesReps] = useState(initialSalesReps);
  const [dialog, setDialog] = useState<{ rep: SalesRep | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesRep | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // initialSalesReps is a fresh array from the server component on every
  // router.refresh() - adjust state during render per React's guidance for
  // syncing state to a changed prop.
  const [prevInitialSalesReps, setPrevInitialSalesReps] = useState(initialSalesReps);
  if (initialSalesReps !== prevInitialSalesReps) {
    setPrevInitialSalesReps(initialSalesReps);
    setSalesReps(initialSalesReps);
  }

  function flash(id: string) {
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  async function handleSubmit(draft: SalesRepDraft) {
    const editing = dialog?.rep;
    const res = await fetch("/api/sales-reps", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...draft } : draft),
    });
    if (!res.ok) throw new Error("save failed");
    const saved = (await res.json()) as SalesRep;
    setSalesReps((prev) =>
      editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved],
    );
    setDialog(null);
    flash(saved.id);
  }

  async function confirmDelete() {
    const rep = pendingDelete;
    if (!rep) return;
    setDeletingId(rep.id);
    try {
      await fetch(`/api/sales-reps?id=${rep.id}`, { method: "DELETE" });
      setSalesReps((prev) => prev.filter((r) => r.id !== rep.id));
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[13px] text-[var(--muted)]">
          총 <span className="font-medium text-[var(--foreground)]">{salesReps.length}</span>명
        </p>
        <Button icon={<Plus size={16} />} onClick={() => setDialog({ rep: null })}>
          사원 추가
        </Button>
      </div>

      <Card className="overflow-hidden">
        {salesReps.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center text-[var(--muted)]">
              <UsersRound size={20} />
            </span>
            <p className="text-[14px] font-medium">등록된 사원이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">견적서 발신 담당자로 쓸 사원을 추가해 보세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {salesReps.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 transition-colors duration-700",
                  flashId === r.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--sidebar-bg)]/50",
                )}
              >
                <Avatar name={r.name} size="sm" />
                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--foreground)] truncate">{r.name}</p>
                    {r.id === DEFAULT_SALES_REP_ID && (
                      <span
                        className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent)]"
                        title="화주 전용 링크로 만든 견적의 기본 발신 담당자"
                      >
                        기본
                      </span>
                    )}
                  </div>
                  <ContactLine icon={<Mail size={13} />} value={r.email} href={r.email ? `mailto:${r.email}` : undefined} />
                  <ContactLine
                    icon={<Phone size={13} />}
                    value={r.phone}
                    href={r.phone ? `tel:${r.phone.replace(/[^0-9+]/g, "")}` : undefined}
                    tabular
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDialog({ rep: r })}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                    aria-label={`${r.name} 수정`}
                  >
                    <Pencil size={14} />
                    <span className="hidden sm:inline">수정</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(r)}
                    disabled={deletingId === r.id}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                    aria-label={`${r.name} 삭제`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SalesRepDialog
        open={dialog != null}
        rep={dialog?.rep ?? null}
        onClose={() => setDialog(null)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title="사원을 삭제할까요?"
        description={
          pendingDelete ? `${pendingDelete.name} 정보가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.` : undefined
        }
        loading={deletingId != null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function ContactLine({
  icon,
  value,
  href,
  tabular,
}: {
  icon: React.ReactNode;
  value?: string;
  href?: string;
  tabular?: boolean;
}) {
  if (!value) {
    return (
      <p className="hidden sm:flex items-center gap-1.5 text-[13px] text-[var(--muted)]/70">
        <span className="text-[var(--muted)]/60">{icon}</span>-
      </p>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        "mt-0.5 sm:mt-0 flex items-center gap-1.5 min-w-0 text-[12.5px] sm:text-[13px] text-[var(--muted)] sm:text-[var(--foreground)] hover:text-[var(--accent)] transition-colors",
        tabular && "tabular-nums",
      )}
    >
      <span className="shrink-0 text-[var(--muted)]">{icon}</span>
      <span className="truncate">{value}</span>
    </a>
  );
}
