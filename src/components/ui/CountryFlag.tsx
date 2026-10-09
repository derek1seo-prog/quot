import { cn } from "@/lib/cn";
import { Globe } from "lucide-react";
import type { ReactNode } from "react";

// 5-point star, point up, as an SVG polygon `points` string.
function starPoints(cx: number, cy: number, r: number): string {
  const inner = r * 0.382;
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

// Simplified 24x24 artwork, recomposed for a circular crop (CN's stars are
// pulled toward the center so the circle doesn't cut them off).
const FLAGS: Record<string, ReactNode> = {
  CN: (
    <>
      <rect width="24" height="24" fill="#DE2910" />
      <g fill="#FFDE00">
        <polygon points={starPoints(8.5, 9.5, 3.8)} />
        <polygon points={starPoints(13.4, 5.6, 1.2)} />
        <polygon points={starPoints(15.6, 8.2, 1.2)} />
        <polygon points={starPoints(15.6, 11.4, 1.2)} />
        <polygon points={starPoints(13.4, 14, 1.2)} />
      </g>
    </>
  ),
  VN: (
    <>
      <rect width="24" height="24" fill="#DA251D" />
      <polygon points={starPoints(12, 12.6, 6.4)} fill="#FFFF00" />
    </>
  ),
  TH: (
    <>
      <rect width="24" height="24" fill="#A51931" />
      <rect y="4" width="24" height="16" fill="#F4F5F8" />
      <rect y="8" width="24" height="8" fill="#2D2A4A" />
    </>
  ),
};

/** Circular inline-SVG country flag. Replaces OS emoji flags, which look
 * glossy next to the app's line icons and don't render at all on Windows. */
export function CountryFlag({
  countryId,
  size = 16,
  className,
  title,
}: {
  countryId: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const art = FLAGS[countryId];
  if (!art) return <Globe size={size} className={className} aria-label={title ?? countryId} />;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? countryId}
      className={cn("shrink-0", className)}
      style={{ clipPath: "circle(50%)" }}
    >
      {title && <title>{title}</title>}
      {art}
      <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    </svg>
  );
}
