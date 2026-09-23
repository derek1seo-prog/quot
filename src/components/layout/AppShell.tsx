"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { Sidebar } from "./Sidebar";
import { MobileSidebarContent } from "./MobileSidebarContent";
import { MenuToggleIcon } from "./MenuToggleIcon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Bumped every time the drawer opens so its content remounts and replays
  // the stagger-in animation instead of just being toggled visible again.
  const [openCount, setOpenCount] = useState(0);
  const pathname = usePathname();

  // Safety net: a route change should always close the drawer, even if a
  // click somehow bypassed the nav link's own onNavigate handler. Adjusted
  // during render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, so it takes effect in the same
  // render pass instead of triggering an extra one.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  // Lock page scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-white/80 backdrop-blur border-b border-[var(--border-subtle)] no-print overflow-hidden">
        {/* Tiny easter egg - a seagull glides across roughly once every
            13s (see .animate-seagull in globals.css). overflow-hidden on
            this bar clips it while parked off-screen, so it can never
            cause horizontal page scroll. */}
        <svg
          viewBox="0 0 24 12"
          className="animate-seagull pointer-events-none absolute left-0 top-1/2 h-3 w-6 -translate-y-1/2 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M1 8 Q6 1 12 6 Q18 1 23 8" />
        </svg>
        <Link href="/" className="flex items-center gap-2">
          <BrandMark imageClassName="w-7 h-7" />
        </Link>
        <button
          onClick={() => {
            setOpen((v) => {
              if (!v) setOpenCount((c) => c + 1);
              return !v;
            });
          }}
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--foreground)] active:bg-[var(--sidebar-bg)] transition-colors"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
        >
          <MenuToggleIcon open={open} />
        </button>
      </div>

      {/* Mobile nav drawer - stays mounted so the backdrop fade and panel
          slide can animate on close as well as open, not just appear/vanish. */}
      <div
        className={`lg:hidden fixed inset-0 z-50 no-print ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[82%] max-w-72 bg-[var(--sidebar-bg)] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-14 flex items-center justify-between px-4 shrink-0 border-b border-[var(--border-subtle)]">
            <span className="text-[14px] font-semibold">메뉴</span>
            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] active:bg-black/5 transition-colors"
              aria-label="닫기"
            >
              <MenuToggleIcon open size={16} />
            </button>
          </div>
          <MobileSidebarContent key={openCount} onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
