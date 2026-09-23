"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const PIN_LENGTH = 4;

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function submit(pin: string) {
    setStatus("checking");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pin }),
      });
      if (res.ok) {
        setStatus("success");
        await new Promise((r) => setTimeout(r, 900));
        router.push(next);
        router.refresh();
        return;
      }
    } catch {
      // fall through to the same error state as a wrong PIN
    }
    setStatus("error");
    setDigits(Array(PIN_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  }

  function handleChange(index: number, raw: string) {
    const value = raw.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = value;
    setDigits(updated);
    setStatus("idle");

    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === PIN_LENGTH - 1 && updated.every((d) => d)) {
      submit(updated.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
      <div
        className={`w-full max-w-[360px] bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center animate-dashboard-fade-up ${
          status === "error" ? "animate-shake" : ""
        }`}
      >
        <BrandMark imageClassName="w-12 h-12" />
        {status === "success" ? (
          <>
            <span className="mt-4 w-12 h-12 rounded-full bg-[var(--success)]/10 flex items-center justify-center animate-success-pop">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-[var(--success)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h1 className="mt-4 text-[17px] font-semibold text-[var(--foreground)] animate-success-text-in">
              환영합니다
            </h1>
            <p
              className="mt-1 text-[13px] text-[var(--muted)] animate-success-text-in"
              style={{ animationDelay: "0.05s" }}
            >
              이동 중입니다...
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[17px] font-semibold text-[var(--foreground)]">
              접근 코드를 입력해주세요
            </h1>
            <p className="mt-1 text-[13px] text-[var(--muted)] text-center">
              이 사이트는 비공개로 운영됩니다.
            </p>

            <div className="mt-6 flex gap-2.5">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={i === 0}
                  maxLength={1}
                  value={digit}
                  disabled={status === "checking"}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  aria-label={`접근 코드 ${i + 1}번째 자리`}
                  className={`w-12 h-14 text-center text-[20px] font-semibold rounded-[var(--radius-sm)] border bg-white text-[var(--foreground)] outline-none transition-shadow focus:ring-4 focus:ring-[var(--accent-soft)] disabled:opacity-50 ${
                    status === "error"
                      ? "border-[var(--danger)]"
                      : "border-[var(--border)] focus:border-[var(--accent)]"
                  }`}
                />
              ))}
            </div>

            <p
              className={`mt-4 h-4 text-[12.5px] font-medium text-[var(--danger)] transition-opacity duration-200 ${
                status === "error" ? "opacity-100" : "opacity-0"
              }`}
            >
              코드가 올바르지 않습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
