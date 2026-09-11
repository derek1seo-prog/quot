"use client";

import { cn } from "@/lib/cn";
import { navSections } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icons";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)]">
      <div className="px-6 h-16 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-[9px] bg-[var(--foreground)] flex items-center justify-center">
          <span className="text-white text-[13px] font-bold tracking-tight">Q</span>
        </div>
        <div className="leading-tight">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">QUOT</p>
          <p className="text-[11px] text-[var(--muted)]">Forwarding Quote System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-6">
        {navSections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 h-9 rounded-[var(--radius-sm)] text-[13.5px] font-medium transition-colors",
                      active
                        ? "bg-white text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
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
        <div className="rounded-[var(--radius-md)] bg-white border border-[var(--border-subtle)] p-3">
          <p className="text-[12px] font-medium text-[var(--foreground)]">중국 → 한국 FCL</p>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">MVP · v1.0</p>
        </div>
      </div>
    </aside>
  );
}
