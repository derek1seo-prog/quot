"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error" | "locked">(
    "idle",
  );
  const [lockSeconds, setLockSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ticks the lockout countdown down to 0, then unlocks the form again -
  // matches "제한이 해제되면 정상적으로 로그인을 시도할 수 있도록".
  useEffect(() => {
    if (status !== "locked") return;
    if (lockSeconds <= 0) {
      requestAnimationFrame(() => setStatus("idle"));
      return;
    }
    const timer = setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, lockSeconds]);

  async function submit() {
    if (!password || status === "checking" || status === "locked") return;
    setStatus("checking");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setStatus("success");
        await new Promise((r) => setTimeout(r, 900));
        router.push(next);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        reason?: string;
        retryAfterSec?: number;
      } | null;
      if (res.status === 429 && body?.reason === "rate_limited") {
        setStatus("locked");
        setLockSeconds(body.retryAfterSec ?? 60);
        setPassword("");
        return;
      }
    } catch {
      // fall through to the same error state as a wrong password
    }
    setStatus("error");
    setPassword("");
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
      <div
        className={`w-full max-w-[360px] bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center animate-dashboard-fade-up ${
          status === "error" || status === "locked" ? "animate-shake" : ""
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

            <form onSubmit={handleSubmit} className="mt-6 w-full flex flex-col items-center gap-3">
              <div className="relative w-full">
                <span
                  className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    status === "error" || status === "locked" ? "text-[var(--danger)]" : "text-[var(--muted)]"
                  }`}
                >
                  {status === "checking" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Lock size={16} />
                  )}
                </span>
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  autoFocus
                  value={password}
                  disabled={status === "checking" || status === "locked"}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="비밀번호"
                  aria-label="비밀번호"
                  className={`w-full h-12 pl-10 pr-10 rounded-[var(--radius-md)] border bg-white text-[15px] text-[var(--foreground)] outline-none transition-all duration-200 focus:ring-4 focus:ring-[var(--accent-soft)] focus:scale-[1.01] disabled:opacity-50 motion-reduce:transition-none ${
                    status === "error" || status === "locked"
                      ? "border-[var(--danger)]"
                      : "border-[var(--border)] focus:border-[var(--accent)]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!password || status === "checking" || status === "locked"}
                icon={status === "checking" ? <Loader2 size={16} className="animate-spin" /> : undefined}
              >
                {status === "checking" ? "확인 중..." : "입장하기"}
              </Button>
            </form>

            <p
              className={`mt-4 h-4 text-[12.5px] font-medium text-[var(--danger)] transition-opacity duration-200 ${
                status === "error" || status === "locked" ? "opacity-100" : "opacity-0"
              }`}
            >
              {status === "locked"
                ? `너무 많이 시도했습니다. ${lockSeconds}초 후 다시 시도해주세요.`
                : "비밀번호가 올바르지 않습니다."}
            </p>

            <Link
              href="/"
              className="mt-6 text-[12.5px] text-[var(--muted)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
            >
              빠른 견적 만들기로 이동하기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
