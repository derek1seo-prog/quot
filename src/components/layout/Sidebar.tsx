"use client";

import { cn } from "@/lib/cn";
import { getActiveHref, type NavSectionDef } from "@/lib/nav";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { NavIcon } from "./nav-icons";

export function Sidebar({
  sections,
  homeHref,
  roleLabel,
}: {
  sections: NavSectionDef[];
  homeHref: string;
  roleLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeHref = getActiveHref(pathname, sections);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useLayoutEffect(() => {
    if (activeRef.current) {
      setIndicatorTop(activeRef.current.offsetTop);
    }
  }, [activeHref]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="no-print hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)]">
      <Link href={homeHref} className="px-6 h-16 flex items-center gap-2.5 shrink-0">
        <Image src="/logo.png" alt="I.S. Sea & Air" width={79} height={79} className="w-8 h-8 object-contain" />
        <div className="leading-tight">
          <p className="text-[11px] text-[var(--muted)]">Forwarding Quote System</p>
        </div>
      </Link>

      <nav className="relative flex-1 overflow-y-auto px-3 pb-6 space-y-6">
        {indicatorTop !== null && (
          <div
            className="absolute top-0 left-3 right-3 h-9 rounded-[var(--radius-sm)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-none"
            style={{ transform: `translateY(${indicatorTop}px)` }}
          />
        )}
        {sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={active ? activeRef : undefined}
                    className={cn(
                      "relative z-10 flex items-center gap-2.5 px-3 h-9 rounded-[var(--radius-sm)] text-[13.5px] font-medium transition-colors",
                      active
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-white/60 hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className={active ? "text-[var(--accent)]" : ""}>
                      <NavIcon icon={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--border-subtle)]">
        <div className="rounded-[var(--radius-md)] bg-white border border-[var(--border-subtle)] p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{roleLabel ?? "수출입 FCL"}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">MVP · v1.0</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors disabled:opacity-40"
            aria-label="로그아웃"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
