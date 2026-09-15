import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

export interface Step {
  label: string;
}

export function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div className="flex items-start w-full max-w-2xl mx-auto mb-10">
      {steps.map((step, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={step.label} className="contents">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors",
                  isDone && "bg-[var(--accent)] text-white",
                  isActive && !isDone && "bg-[var(--foreground)] text-white",
                  !isActive && !isDone && "bg-[var(--sidebar-bg)] text-[var(--muted)] border border-[var(--border)]",
                )}
              >
                {isDone ? <Check size={15} /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[12px] font-medium whitespace-nowrap",
                  isActive || isDone ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 min-w-[8px] h-[1.5px] mx-2 mt-4 transition-colors",
                  isDone ? "bg-[var(--accent)]" : "bg-[var(--border)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
