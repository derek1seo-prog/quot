import { RateLookupForm } from "@/components/lookup/RateLookupForm";
import { getSession } from "@/lib/auth/require";
import { redirect } from "next/navigation";

export default async function PublicHomePage() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "customer") redirect("/portal");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border-subtle)] bg-white">
        <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="I.S. Sea & Air" className="w-8 h-8 object-contain" />
            <span className="text-[14px] font-semibold text-[var(--foreground)]">I.S. SEA &amp; AIR CO.,LTD</span>
          </div>
          <a
            href="/login"
            className="text-[13.5px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            로그인
          </a>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-12 lg:py-20">
        <div className="text-center mb-12 animate-menu-item">
          <p className="text-[13px] font-medium text-[var(--accent)] mb-2">중국·베트남·태국 FCL 운임 조회</p>
          <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-[var(--foreground)]">
            출발항과 도착항만 입력하면
            <br />
            예상 운임을 바로 확인하세요
          </h1>
          <p className="text-[14px] text-[var(--muted)] mt-4">
            해상운임부터 각종 할증료까지, 전체 항목을 투명하게 보여드립니다.
          </p>
        </div>

        <RateLookupForm />
      </div>
    </div>
  );
}
