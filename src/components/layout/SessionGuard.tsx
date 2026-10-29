"use client";

import { Button } from "@/components/ui/Button";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Admin pages: notices when the login has run out (an /api call answers
 * 401 session_expired, or 403 because the session fell back to guest) and
 * asks for the PIN right there - the page, and anything typed on it (a
 * quote in progress, unsaved sheet rows), stays as it is. */
export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "error" | "locked">("idle");
  const [lockSeconds, setLockSeconds] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const openRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const original = window.fetch;
    const trigger = () => {
      if (openRef.current) return; // several requests can fail at once
      openRef.current = true;
      setOpen(true);
      setStatus("idle");
      setPassword("");
    };
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.status !== 401 && res.status !== 403) return res;
      try {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/unlock")) {
          return res;
        }
        if (res.status === 403) trigger();
        else {
          const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
          if (body?.code === "session_expired") trigger();
        }
      } catch {
        // not something to act on
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (status !== "locked") return;
    if (lockSeconds <= 0) {
      const id = requestAnimationFrame(() => setStatus("idle"));
      return () => cancelAnimationFrame(id);
    }
    const timer = setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, lockSeconds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || status === "checking" || status === "locked") return;
    setStatus("checking");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        openRef.current = false;
        setOpen(false);
        setPassword("");
        setStatus("idle");
        router.refresh();
        setToast({ id: Date.now(), text: "다시 로그인했어요 · 방금 저장되지 않은 작업은 한 번 더 시도해 주세요" });
        return;
      }
      const body = (await res.json().catch(() => null)) as { reason?: string; retryAfterSec?: number } | null;
      if (res.status === 429 && body?.reason === "rate_limited") {
        setStatus("locked");
        setLockSeconds(body.retryAfterSec ?? 60);
        setPassword("");
        return;
      }
    } catch {
      // same as a wrong password
    }
    setStatus("error");
    setPassword("");
    inputRef.current?.focus();
  }

  return (
    <>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" />
            <form
              onSubmit={submit}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="session-expired-title"
              className="relative w-full max-w-[380px] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)] animate-modal-panel"
            >
              <span className="mx-auto w-12 h-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                <LockKeyhole size={20} />
              </span>
              <h2 id="session-expired-title" className="mt-3 text-center text-[16px] font-semibold text-[var(--foreground)]">
                로그인이 만료됐어요
              </h2>
              <p className="mt-1 text-center text-[13px] text-[var(--muted)]">
                비밀번호를 다시 입력하면 이어서 작업할 수 있어요.
                <br />
                입력 중인 내용은 그대로 남아 있어요.
              </p>
              <div className="relative mt-5">
                <input
                  ref={inputRef}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  disabled={status === "locked"}
                  placeholder="비밀번호"
                  aria-label="비밀번호"
                  autoComplete="current-password"
                  className="w-full h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-3.5 pr-10 text-[16px] sm:text-[14px] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:bg-[var(--sidebar-bg)]"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sidebar-bg)]"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="mt-2 min-h-[18px] text-center text-[12.5px] text-[var(--danger)]" aria-live="polite">
                {status === "error" ? "비밀번호가 맞지 않아요." : status === "locked" ? `잠시 후 다시 시도해 주세요 (${lockSeconds}초)` : ""}
              </p>
              <Button
                type="submit"
                className="mt-2 w-full justify-center"
                disabled={!password || status === "checking" || status === "locked"}
                icon={status === "checking" ? <Loader2 size={15} className="animate-spin" /> : undefined}
              >
                {status === "checking" ? "확인 중..." : "다시 로그인"}
              </Button>
              <a
                href={`/unlock?next=${encodeURIComponent(pathname)}`}
                className="mt-3 block text-center text-[12.5px] text-[var(--muted)] hover:text-[var(--accent)]"
              >
                로그인 화면으로 이동
              </a>
            </form>
          </div>,
          document.body,
        )}
      <Toast message={toast} onDismiss={() => setToast(null)} durationMs={4500} />
    </>
  );
}
