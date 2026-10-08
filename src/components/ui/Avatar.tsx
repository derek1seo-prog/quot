import { cn } from "@/lib/cn";

/** Initial-letter avatar; the colour is stable per name. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letter = name.trim().charAt(0) || "?";
  const hues = [214, 160, 262, 24, 340, 190];
  const hue = hues[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-full font-semibold",
        size === "md" ? "w-10 h-10 text-[15px]" : "w-9 h-9 text-[14px]",
      )}
      style={{ background: `hsl(${hue} 85% 95%)`, color: `hsl(${hue} 60% 38%)` }}
    >
      {letter}
    </span>
  );
}

/** Calm monochrome initial avatar with a soft ring - used by the 사원 / 화주
 * lists. `highlighted` gives it the accent treatment (e.g. 기본 담당자). */
export function MonoAvatar({
  name,
  highlighted = false,
  size = "md",
}: {
  name: string;
  highlighted?: boolean;
  size?: "xs" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full inline-flex items-center justify-center font-semibold ring-1",
        size === "md" ? "w-10 h-10 text-[14.5px]" : "w-6 h-6 text-[11px]",
        highlighted
          ? "bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white ring-[var(--accent)]/20 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]"
          : "bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] text-[#334155] ring-black/[0.04]",
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
