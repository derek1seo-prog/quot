"use client";

import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import type { Role } from "@/lib/nav";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
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
        {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      </button>
    );
  }
  if (role === "guest") {
    return <AdminLoginButton />;
  }
  return null;
}

/** Slightly more noticeable than a plain icon button (accent-tinted, not
 * muted) since this is the one action a would-be admin actually needs to
 * find - and a hover/focus tooltip, same pattern as BrandMark's own
 * speech-bubble, so its purpose reads at a glance without a label taking
 * up permanent space next to it. Anchored to the right edge (`right-0`),
 * not left like BrandMark's - this button sits at the right end of its
 * row in both the sidebar header and the mobile top bar, so a
 * left-anchored bubble would run off the edge instead of BrandMark's
 * near-left-edge case, which grows safely rightward. */
function AdminLoginButton() {
  const [hovering, setHovering] = useState(false);
  return (
    <span className="relative inline-flex">
      <Link
        href="/unlock"
        aria-label="관리자 로그인"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        className={cn(buttonClass, "text-[var(--accent)] hover:bg-[var(--accent-soft)]")}
      >
        <ShieldCheck size={16} />
      </Link>
      <span
        className={cn(
          TOOLTIP_BUBBLE_CLASS,
          "pointer-events-none absolute right-0 top-full z-50 mt-2 transition-all duration-200 motion-reduce:transition-none",
          hovering ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        )}
      >
        관리자 로그인하기
      </span>
    </span>
  );
}
