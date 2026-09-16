import { cn } from "@/lib/cn";
import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="flex items-baseline justify-between mb-1.5">
      <span className="text-[13px] font-medium text-[var(--foreground)]">{children}</span>
      {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

const controlClasses =
  "w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[14px] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] placeholder:text-[var(--muted)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClasses, className)} {...props} />;
  },
);

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlClasses, "h-auto py-2 min-h-[80px] resize-y", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClasses, "appearance-none pr-8 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}
