"use client";

import type { Role } from "@/lib/nav";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const buttonClass =
  "shrink-0 w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/60 transition-colors disabled:opacity-40 disabled:pointer-events-none";

/** Icon-only login/logout toggle - shown in the sidebar (desktop) and
 * mobile top bar, next to the brand mark, so it's visible regardless of
 * which page is open. Admin sessions log out (the quick-quote screen is
 * now its own always-present nav tab, so there's no more need for a
 * separate "preview" of it - logging out is the only thing this icon does
 * for an admin). Guest sessions still need the real PIN, so that
 * direction points at /unlock. Customer sessions get neither - their
 * portal doesn't invite switching to admin. */
export function RoleSwitchButton({ role }: { role: Role }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (role === "admin") {
    async function handleLogout() {
      setLoggingOut(true);
      await fetch("/api/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    }
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title="로그아웃"
        aria-label="로그아웃"
        className={buttonClass}
      >
        <LogOut size={16} />
      </button>
    );
  }
  if (role === "guest") {
    return (
      <Link href="/unlock" title="관리자 로그인" aria-label="관리자 로그인" className={buttonClass}>
        <ShieldCheck size={16} />
      </Link>
    );
  }
  return null;
}
