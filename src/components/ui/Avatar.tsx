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
