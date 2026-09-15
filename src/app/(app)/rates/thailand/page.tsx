import { Card, CardContent } from "@/components/ui/Card";
import { Construction } from "lucide-react";

export default function ThailandRatesPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <p className="text-[13px] font-medium text-[var(--accent)] mb-2">요율 관리</p>
      <h1 className="text-[28px] font-semibold tracking-tight mb-8">태국</h1>

      <Card className="overflow-hidden">
        <CardContent className="py-16 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-4">
            <Construction size={20} />
          </div>
          <p className="text-[15px] font-medium text-[var(--foreground)]">개발 중입니다</p>
          <p className="text-[13px] text-[var(--muted)] mt-1">태국 요율 관리는 곧 지원될 예정입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
