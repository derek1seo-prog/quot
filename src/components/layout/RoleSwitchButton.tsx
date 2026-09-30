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
 * which page is open. Admin AND customer sessions log out (a customer
 * session is entered via their own /c/[accessToken] link, with no PIN
 * step to "undo" - without this, there was genuinely no way back to the
 * admin login screen or a logged-out state once inside /my, since "/"
 * itself always redirects an active customer session straight back to
 * /my). Guest sessions still need the real PIN, so that direction points
 * at /unlock. */
export function RoleSwitchButton({ role }: { role: Role }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (role === "admin" || role === "customer") {
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
