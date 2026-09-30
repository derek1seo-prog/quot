"use client";

import { cn } from "@/lib/cn";
import { getActiveHref, getNavSections, type Role } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icons";

export function MobileSidebarContent({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const navSections = getNavSections(role);
  const activeHref = getActiveHref(pathname, navSections);
  let itemIndex = 0;

  return (
    <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-6 space-y-6">
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
                    "group flex items-center gap-2.5 px-3 h-10 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors animate-menu-item",
                    active
                      ? "bg-white text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:bg-white/60 hover:text-[var(--foreground)] active:bg-white/60",
                  )}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <span
                    className={`transition-transform duration-200 ${
                      active ? "text-[var(--accent)]" : "group-hover:scale-110 group-hover:text-[var(--accent)]"
                    }`}
                  >
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
