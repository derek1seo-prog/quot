"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileSidebarContent } from "./MobileSidebarContent";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-white/80 backdrop-blur border-b border-[var(--border-subtle)] no-print">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--foreground)] flex items-center justify-center">
            <span className="text-white text-[12px] font-bold">Q</span>
          </div>
          <span className="text-[14px] font-semibold">QUOT</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--foreground)] active:bg-[var(--sidebar-bg)]"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-[var(--sidebar-bg)] shadow-xl flex flex-col">
            <div className="h-14 flex items-center justify-between px-4">
              <span className="text-[14px] font-semibold">메뉴</span>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)]"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <MobileSidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
