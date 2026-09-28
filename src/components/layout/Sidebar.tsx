"use client";

import { cn } from "@/lib/cn";
import { getActiveHref, getNavSections, type Role } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";
import { NavIcon } from "./nav-icons";
import { RoleSwitchButton } from "./RoleSwitchButton";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const navSections = getNavSections(role);
  const activeHref = getActiveHref(pathname, navSections);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (activeRef.current) {
      setIndicatorTop(activeRef.current.offsetTop);
    }
  }, [activeHref]);

  return (
    <aside className="no-print hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)]">
      <div className="px-6 h-16 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <BrandMark imageClassName="w-8 h-8" />
          <div className="leading-tight min-w-0">
            <p className="text-[11px] text-[var(--muted)] truncate">Forwarding Quote System</p>
          </div>
        </Link>
        <RoleSwitchButton role={role} />
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 pb-6 space-y-6">
        {indicatorTop !== null && (
          <div
            className="absolute top-0 left-3 right-3 h-9 rounded-[var(--radius-sm)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-none"
            style={{ transform: `translateY(${indicatorTop}px)` }}
          />
        )}
        {navSections.map((section, i) => (
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
                      <NavIcon icon={item.icon} countryId={item.countryId} />
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
        <div className="rounded-[var(--radius-md)] bg-white border border-[var(--border-subtle)] p-3">
          <p className="text-[12px] font-medium text-[var(--foreground)]">수출입 FCL</p>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">MVP · v1.0</p>
        </div>
      </div>
    </aside>
  );
}
