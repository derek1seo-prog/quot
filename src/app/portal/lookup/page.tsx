import { RateLookupForm } from "@/components/lookup/RateLookupForm";

export default function PortalLookupPage() {
  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-[var(--accent)] mb-2">화주 포털</p>
        <h1 className="text-[28px] font-semibold tracking-tight">운임 조회</h1>
      </div>
      <RateLookupForm />
    </div>
  );
}
