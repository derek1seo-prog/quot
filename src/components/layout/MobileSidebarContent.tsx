"use client";

import { cn } from "@/lib/cn";
import { getActiveHref, navSections } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icons";

export function MobileSidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname);
  let itemIndex = 0;

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-6">
      {navSections.map((section, i) => (
        <div key={i}>
          {section.title && (
            <p
              className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] animate-menu-item"
              style={{ animationDelay: `${itemIndex++ * 30}ms` }}
            >
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === activeHref;
              const delay = itemIndex++ * 30;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 px-3 h-10 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors animate-menu-item",
                    active
                      ? "bg-white text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] active:bg-white/60",
                  )}
                  style={{ animationDelay: `${delay}ms` }}
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
  );
}
