"use client";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import { useRememberedSalesRepId } from "@/lib/hooks";
import type { SalesRep } from "@/lib/types";
import { Check, Copy, Mail, Pencil, Phone, Plus, Star, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { SalesRepDialog, type SalesRepDraft } from "./SalesRepDialog";

/** Korean job titles, most senior first - used to split "김태현 대리" into
 * name + 직급 and to order the list. */
const RANKS = ["대표", "이사", "부장", "차장", "과장", "대리", "주임", "사원"];

function splitRank(full: string): { name: string; rank: string | null } {
  const parts = full.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && RANKS.includes(last)) return { name: parts.slice(0, -1).join(" "), rank: last };
  return { name: full.trim(), rank: null };
}

function rankOrder(rank: string | null) {
  const i = rank ? RANKS.indexOf(rank) : -1;
  return i < 0 ? RANKS.length : i;
}

/** 사원 관리 list: headcount, then one row per rep
 * ordered by seniority. 수정 / 삭제 / 기본 지정 are quiet icon actions;
 * email and phone can be copied in one click. */
export function SalesRepsTable({ initialSalesReps }: { initialSalesReps: SalesRep[] }) {
  const [salesReps, setSalesReps] = useState(initialSalesReps);
  const [dialog, setDialog] = useState<{ rep: SalesRep | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesRep | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  // "기본" = the 견적 담당자 this browser pre-selects in the quote forms (the
  // remembered last pick, else the app default) - setting it here updates
  // the same stored value.
  const [defaultRepId, setDefaultRepId] = useRememberedSalesRepId(salesReps);

  // initialSalesReps is a fresh array from the server component on every
  // router.refresh() - adjust state during render per React's guidance for
  // syncing state to a changed prop.
  const [prevInitialSalesReps, setPrevInitialSalesReps] = useState(initialSalesReps);
  if (initialSalesReps !== prevInitialSalesReps) {
    setPrevInitialSalesReps(initialSalesReps);
    setSalesReps(initialSalesReps);
  }

  const rows = useMemo(
    () =>
      salesReps
        .map((r) => ({ rep: r, ...splitRank(r.name) }))
        .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank) || a.name.localeCompare(b.name, "ko")),
    [salesReps],
  );

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
    setSalesReps((prev) => (editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]));
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
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11.5px] font-medium tracking-wide text-[var(--muted)]">구성원</p>
          <p className="mt-0.5 text-[26px] leading-none font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
            {salesReps.length}
            <span className="ml-1 text-[14px] font-medium text-[var(--muted)]">명</span>
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setDialog({ rep: null })} className="shrink-0">
          사원 추가
        </Button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center text-[var(--muted)]">
              <UsersRound size={20} />
            </span>
            <p className="text-[14px] font-medium">등록된 사원이 없습니다.</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">견적서 발신 담당자로 쓸 사원을 추가해 보세요.</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_112px] gap-4 px-6 py-3 border-b border-[var(--border-subtle)] text-[11px] font-medium tracking-wide text-[var(--muted)]">
              <span>구성원</span>
              <span>이메일</span>
              <span>연락처</span>
              <span />
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {rows.map(({ rep: r, name, rank }) => {
                const isDefault = r.id === defaultRepId;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_112px] items-center gap-x-4 gap-y-1 px-4 sm:px-6 py-4 transition-colors duration-700 first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]",
                      flashId === r.id ? "bg-[var(--accent-soft)]" : "hover:bg-[#f8fafc]",
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 sm:col-auto">
                      <RepAvatar name={name} highlighted={isDefault} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)] truncate">
                            {name}
                          </p>
                          {rank && (
                            <span className="shrink-0 rounded-[6px] bg-[var(--sidebar-bg)] px-1.5 py-[1px] text-[11px] font-medium text-[var(--muted)]">
                              {rank}
                            </span>
                          )}
                          {isDefault && (
                            <span
                              className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-[1px] text-[11px] font-semibold text-[var(--accent)]"
                              title="이 브라우저에서 견적 작성 시 기본으로 선택되는 담당자"
                            >
                              기본
                            </span>
                          )}
                        </div>
                        <div className="sm:hidden mt-1 space-y-0.5 text-[12px] text-[var(--muted)]">
                          {r.email && <p className="truncate">{r.email}</p>}
                          {r.phone && <p className="tabular-nums">{r.phone}</p>}
                        </div>
                      </div>
                    </div>

                    <CopyField icon={<Mail size={13} />} value={r.email} className="hidden sm:flex" />
                    <CopyField icon={<Phone size={13} />} value={r.phone} tabular className="hidden sm:flex" />

                    <div className="flex items-center justify-end gap-0.5 col-start-2 sm:col-start-auto row-start-1 sm:row-start-auto">
                      {!isDefault && (
                        <IconAction
                          label="기본 담당자로 지정"
                          onClick={() => {
                            setDefaultRepId(r.id);
                            flash(r.id);
                          }}
                          hoverClass="hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          reveal
                        >
                          <Star size={15} />
                        </IconAction>
                      )}
                      <IconAction
                        label="수정"
                        onClick={() => setDialog({ rep: r })}
                        hoverClass="hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
                      >
                        <Pencil size={15} />
                      </IconAction>
                      <IconAction
                        label="삭제"
                        onClick={() => setPendingDelete(r)}
                        disabled={deletingId === r.id}
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

/** Monochrome initial avatar with a soft ring; the 기본 담당자 gets the
 * accent treatment instead of a random colour per person. */
function RepAvatar({ name, highlighted }: { name: string; highlighted: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center text-[14.5px] font-semibold ring-1",
        highlighted
          ? "bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white ring-[var(--accent)]/20 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]"
          : "bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] text-[#334155] ring-black/[0.04]",
      )}
    >
      {name.charAt(0) || "?"}
    </span>
  );
}

/** Icon-only action with a hover bubble. `reveal` hides it until the row is
 * hovered on desktop (always shown on touch). */
function IconAction({
  label,
  onClick,
  disabled,
  hoverClass,
  reveal,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hoverClass: string;
  reveal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-flex group/act">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[#94a3b8] transition-all disabled:opacity-40",
          hoverClass,
          reveal && "sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {children}
      </button>
      <span
        className={cn(
          TOOLTIP_BUBBLE_CLASS,
          "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 opacity-0 translate-y-1 transition-all duration-150 group-hover/act:opacity-100 group-hover/act:translate-y-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Email / phone with a copy button that appears on hover. */
function CopyField({
  icon,
  value,
  tabular,
  className,
}: {
  icon: React.ReactNode;
  value?: string;
  tabular?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return <span className={cn("items-center gap-2 text-[13px] text-[#cbd5e1]", className)}>—</span>;
  }
  async function copy() {
    await navigator.clipboard.writeText(value!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  }
  return (
    <span className={cn("group/copy items-center gap-2 min-w-0", className)}>
      <span className="shrink-0 text-[#94a3b8]">{icon}</span>
      <span className={cn("truncate text-[13px] text-[#334155]", tabular && "tabular-nums tracking-[0.01em]")}>{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`${value} 복사`}
        className={cn(
          "shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-[6px] transition-all",
          copied
            ? "text-[var(--success)] opacity-100"
            : "text-[#94a3b8] opacity-0 group-hover/copy:opacity-100 focus-visible:opacity-100 hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]",
        )}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
