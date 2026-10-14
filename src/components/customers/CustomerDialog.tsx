"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { formatPhone } from "@/components/sales-reps/SalesRepDialog";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Customer, SalesRep } from "@/lib/types";
import { Building2, Contact, Loader2, Phone, Truck, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TruckingField =
  | "incheonTruckingRate20ft"
  | "incheonTruckingRate40hq"
  | "busanTruckingRate20ft"
  | "busanTruckingRate40hq"
  | "pyeongtaekTruckingRate20ft"
  | "pyeongtaekTruckingRate40hq";

export type SafeRateField =
  | "incheonSafeRate20ft"
  | "incheonSafeRate40hq"
  | "busanSafeRate20ft"
  | "busanSafeRate40hq"
  | "pyeongtaekSafeRate20ft"
  | "pyeongtaekSafeRate40hq";

export const TRUCKING_PORTS: {
  label: string;
  fields: { field: TruckingField; safeField: SafeRateField; size: string }[];
}[] = [
  {
    label: "인천항",
    fields: [
      { field: "incheonTruckingRate20ft", safeField: "incheonSafeRate20ft", size: "20FT" },
      { field: "incheonTruckingRate40hq", safeField: "incheonSafeRate40hq", size: "40HQ" },
    ],
  },
  {
    label: "부산항",
    fields: [
      { field: "busanTruckingRate20ft", safeField: "busanSafeRate20ft", size: "20FT" },
      { field: "busanTruckingRate40hq", safeField: "busanSafeRate40hq", size: "40HQ" },
    ],
  },
  {
    label: "평택항",
    fields: [
      { field: "pyeongtaekTruckingRate20ft", safeField: "pyeongtaekSafeRate20ft", size: "20FT" },
      { field: "pyeongtaekTruckingRate40hq", safeField: "pyeongtaekSafeRate40hq", size: "40HQ" },
    ],
  },
];

/** 운송료 vs 안전운임, for the dialog's comparison line and the list's
 * marker/tooltip. null unless both amounts are on file. */
export function compareToSafeRate(rate: number | undefined, safe: number | undefined) {
  if (rate == null || safe == null || safe <= 0) return null;
  const diff = rate - safe;
  const pct = Math.round((Math.abs(diff) / safe) * 100);
  return {
    tone: diff < 0 ? ("below" as const) : diff === 0 ? ("equal" as const) : ("above" as const),
    text:
      diff < 0
        ? `▼${formatNumber(-diff)} (${pct}%)`
        : diff === 0
          ? "동일"
          : `▲${formatNumber(diff)} (${pct}%)`,
    title:
      diff === 0
        ? `안전운임 ₩${formatNumber(safe)}과 동일`
        : `안전운임 ₩${formatNumber(safe)} · ${formatNumber(Math.abs(diff))}(${pct}%) ${diff < 0 ? "낮음" : "높음"}`,
  };
}

export interface CustomerDraft {
  name: string;
  contactName: string;
  phone: string;
  salesRepId: string;
  rates: Record<TruckingField, string>;
  safeRates: Record<SafeRateField, string>;
}

function draftFrom(c: Customer | null): CustomerDraft {
  const rates = {} as Record<TruckingField, string>;
  const safeRates = {} as Record<SafeRateField, string>;
  for (const p of TRUCKING_PORTS)
    for (const f of p.fields) {
      rates[f.field] = c?.[f.field] != null ? String(c[f.field]) : "";
      safeRates[f.safeField] = c?.[f.safeField] != null ? String(c[f.safeField]) : "";
    }
  return {
    name: c?.name ?? "",
    contactName: c?.contactName ?? "",
    phone: c?.phone ?? "",
    salesRepId: c?.salesRepId ?? "",
    rates,
    safeRates,
  };
}

/** Add / edit dialog for a 화주: basic info, assigned 견적 담당자, and the
 * six 내륙운송료 grouped by port. Enter saves, Esc / backdrop closes. */
export function CustomerDialog({
  open,
  customer,
  salesReps,
  existingNames,
  onClose,
  onSubmit,
}: {
  open: boolean;
  customer: Customer | null;
  salesReps: SalesRep[];
  /** Other customers' names, to warn about duplicates. */
  existingNames: string[];
  onClose: () => void;
  onSubmit: (draft: CustomerDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomerDraft>(() => draftFrom(null));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const key = open ? (customer?.id ?? "new") : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setDraft(draftFrom(customer));
      setTouched(false);
      setSaving(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => nameRef.current?.focus(), 50);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, saving, onClose]);

  if (!open || typeof document === "undefined") return null;

  const trimmedName = draft.name.trim();
  const nameError = !trimmedName
    ? "화주명을 입력해 주세요."
    : existingNames.includes(trimmedName)
      ? "이미 등록된 화주명입니다."
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...draft, name: trimmedName });
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
        onClick={() => !saving && onClose()}
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-dialog-title"
        noValidate
        className="relative w-full sm:max-w-[560px] max-h-[92vh] flex flex-col rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <Avatar name={draft.name} />
            <div>
              <h2 id="customer-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                {customer ? "화주 정보 수정" : "화주 추가"}
              </h2>
              <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                견적 작성 시 수신 정보와 내륙운송료가 자동으로 연동됩니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="닫기"
            className="w-8 h-8 -mr-2 -mt-1 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IconField
              label="화주명"
              icon={<Building2 size={15} />}
              error={touched ? nameError : null}
              className="sm:col-span-2"
            >
              <Input
                ref={nameRef}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="예: 지더블유파트너스"
                className={cn("pl-9", touched && nameError && "border-[var(--danger)]")}
              />
            </IconField>
            <IconField label="담당자" hint="선택" icon={<UserRound size={15} />}>
              <Input
                value={draft.contactName}
                onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
                placeholder="예: 이신후 부장님"
                className="pl-9"
              />
            </IconField>
            <IconField label="연락처" hint="선택" icon={<Phone size={15} />}>
              <Input
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
                placeholder="예: 02-712-1014"
                className="pl-9 tabular-nums"
              />
            </IconField>
            <FieldGroup className="sm:col-span-2">
              <FieldLabel hint="선택">견적 담당자</FieldLabel>
              <Dropdown
                value={draft.salesRepId}
                onChange={(v) => setDraft((d) => ({ ...d, salesRepId: v }))}
                aria-label="견적 담당자"
                icon={<Contact size={15} />}
                options={[
                  { value: "", label: "지정 안 함" },
                  ...salesReps.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
              <p className="text-[11.5px] text-[var(--muted)] mt-1.5">
                견적에서 이 화주를 고르면 발신 담당자로 자동 선택됩니다.
              </p>
            </FieldGroup>
          </section>

          <section>
            <div className="flex items-center gap-1.5 mb-3">
              <Truck size={14} className="text-[var(--muted)]" />
              <p className="text-[13px] font-medium text-[var(--foreground)]">내륙운송료</p>
              <span className="text-[11.5px] text-[var(--muted)]">· 항구 → 입고지, KRW</span>
            </div>
            <p className="text-[11.5px] text-[var(--muted)] mb-3">
              아래 칸 &lsquo;안전&rsquo;은 안전운임 (참고용) · 견적에는 위 칸 운송료가 들어가요
            </p>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
              {TRUCKING_PORTS.map((p) => (
                <div key={p.label} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="w-12 shrink-0 pt-2 text-[13px] font-medium text-[var(--foreground)]">{p.label}</span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {p.fields.map((f) => {
                      const cmp = compareToSafeRate(
                        draft.rates[f.field] !== "" ? Number(draft.rates[f.field]) : undefined,
                        draft.safeRates[f.safeField] !== "" ? Number(draft.safeRates[f.safeField]) : undefined,
                      );
                      return (
                        <div key={f.field} className="space-y-1">
                          <MoneyInput
                            label={f.size}
                            value={draft.rates[f.field]}
                            onChange={(v) => setDraft((d) => ({ ...d, rates: { ...d.rates, [f.field]: v } }))}
                          />
                          <MoneyInput
                            label="안전"
                            ariaLabel={`${f.size} 안전운임`}
                            subtle
                            value={draft.safeRates[f.safeField]}
                            onChange={(v) =>
                              setDraft((d) => ({ ...d, safeRates: { ...d.safeRates, [f.safeField]: v } }))
                            }
                          />
                          <p
                            className={cn(
                              "h-4 text-right text-[11px] tabular-nums",
                              cmp?.tone === "below" ? "text-[var(--accent)]" : "text-[var(--muted)]",
                            )}
                            title={cmp?.title}
                          >
                            {cmp && (cmp.tone === "equal" ? "안전운임과 동일" : `안전운임 대비 ${cmp.text}`)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={saving || (touched && Boolean(nameError))}
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}
          >
            {saving ? "저장 중..." : customer ? "변경사항 저장" : "추가하기"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function IconField({
  label,
  hint,
  icon,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <FieldGroup className={className}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
            error ? "text-[var(--danger)]" : "text-[var(--muted)]",
          )}
        >
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="text-[12px] text-[var(--danger)] mt-1.5">{error}</p>}
    </FieldGroup>
  );
}

/** Won amount: digits while focused, comma-formatted at rest, with the
 * container size as a leading label inside the box. */
function MoneyInput({
  label,
  value,
  onChange,
  ariaLabel,
  subtle = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  /** Secondary (안전운임) box: shorter, on a muted background. */
  subtle?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--muted)]">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={focused ? value : value !== "" ? formatNumber(Number(value)) : ""}
        placeholder="-"
        onFocus={(e) => {
          const el = e.target;
          setFocused(true);
          requestAnimationFrame(() => el.select());
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label={ariaLabel ?? `${label} 운송료`}
        className={cn(
          "w-full pl-12 pr-2.5 rounded-[var(--radius-sm)] border text-right tabular-nums outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]",
          subtle
            ? "h-8 border-[var(--border-subtle)] bg-[var(--sidebar-bg)] text-[12.5px] text-[var(--muted)] focus:bg-white focus:text-[var(--foreground)]"
            : "h-9 border-[var(--border)] bg-white text-[13.5px] text-[var(--foreground)]",
        )}
      />
    </label>
  );
}
