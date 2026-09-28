import type { Role } from "@/lib/nav";
import { Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";

const buttonClass =
  "shrink-0 w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/60 transition-colors";

/** Icon-only toggle between the guest experience and admin login - shown
 * in the sidebar (desktop) and mobile top bar, next to the brand mark, so
 * it's visible regardless of which page is open. Admin -> guest is a
 * plain link (an admin session already has no restriction on /guest, see
 * proxy.ts - no session change needed, they keep their admin session and
 * can navigate straight back). Guest -> admin genuinely needs the PIN, so
 * that direction points at /unlock. Customer sessions get neither - their
 * portal doesn't invite switching to admin. */
export function RoleSwitchButton({ role }: { role: Role }) {
  if (role === "admin") {
    return (
      <Link href="/guest" title="게스트 화면 미리보기" aria-label="게스트 화면 미리보기" className={buttonClass}>
        <Eye size={16} />
      </Link>
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
