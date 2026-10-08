"use client";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { SalesRep } from "@/lib/types";
import { Loader2, Mail, Phone, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SalesRepDraft {
  name: string;
  email: string;
  phone: string;
}

/** Formats Korean phone numbers as they're typed: 010-1234-5678,
 * 02-123-4567, 031-123-4567, 070-1234-5678. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add / edit dialog for a 사원 - labeled fields, inline validation,
 * Enter to save, Esc or the backdrop to close. */
export function SalesRepDialog({
  open,
  rep,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** The rep being edited, or null to add a new one. */
  rep: SalesRep | null;
  onClose: () => void;
  onSubmit: (draft: SalesRepDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SalesRepDraft>({ name: "", email: "", phone: "" });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset the form each time the dialog opens (for a different rep, or for "add").
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? (rep?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setDraft({ name: rep?.name ?? "", email: rep?.email ?? "", phone: rep?.phone ?? "" });
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

  const nameError = !draft.name.trim() ? "이름을 입력해 주세요." : null;
  const emailError = draft.email.trim() && !EMAIL_RE.test(draft.email.trim()) ? "이메일 형식이 올바르지 않습니다." : null;
  const phoneDigits = draft.phone.replace(/\D/g, "");
  const phoneError = phoneDigits && phoneDigits.length < 9 ? "전화번호를 끝까지 입력해 주세요." : null;
  const invalid = Boolean(nameError || emailError || phoneError);
  const unchanged =
    rep != null &&
    draft.name.trim() === rep.name &&
    draft.email.trim() === (rep.email ?? "") &&
    draft.phone.trim() === (rep.phone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid || saving) return;
    if (unchanged) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() });
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
        aria-labelledby="sales-rep-dialog-title"
        className="relative w-full sm:max-w-[440px] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
        noValidate
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <Avatar name={draft.name} />
            <div>
              <h2 id="sales-rep-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                {rep ? "사원 정보 수정" : "사원 추가"}
              </h2>
              <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                견적서 발신 정보(이름·이메일·전화번호)로 사용됩니다.
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

        <div className="px-6 pt-5 pb-2 space-y-4">
          <Field label="이름" icon={<UserRound size={15} />} error={touched ? nameError : null}>
            <Input
              ref={nameRef}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="예: 김태현 대리"
              className={cn("pl-9", touched && nameError && "border-[var(--danger)]")}
            />
          </Field>
          <Field label="이메일" hint="선택" icon={<Mail size={15} />} error={touched ? emailError : null}>
            <Input
              type="email"
              inputMode="email"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              onBlur={() => draft.email && setTouched(true)}
              placeholder="예: thkim@isseaair.com"
              className={cn("pl-9", touched && emailError && "border-[var(--danger)]")}
            />
          </Field>
          <Field label="전화번호" hint="선택" icon={<Phone size={15} />} error={touched ? phoneError : null}>
            <Input
              type="tel"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
              placeholder="예: 010-2390-7089"
              className={cn("pl-9 tabular-nums", touched && phoneError && "border-[var(--danger)]")}
            />
          </Field>
          {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={saving || (touched && invalid)}
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}
          >
            {saving ? "저장 중..." : rep ? "변경사항 저장" : "추가하기"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  hint,
  icon,
  error,
  children,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <FieldGroup>
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

/** Initial-letter avatar; the colour is stable per name. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letter = name.trim().charAt(0) || "?";
  const hues = [214, 160, 262, 24, 340, 190];
  const hue = hues[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-full font-semibold",
        size === "md" ? "w-10 h-10 text-[15px]" : "w-9 h-9 text-[14px]",
      )}
      style={{ background: `hsl(${hue} 85% 95%)`, color: `hsl(${hue} 60% 38%)` }}
    >
      {letter}
    </span>
  );
}
