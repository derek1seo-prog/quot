export function MenuToggleIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  const offset = Math.round(size * 0.28);
  const bar =
    "absolute left-0 right-0 top-1/2 h-[1.6px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]";

  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <span
        className={bar}
        style={{
          transform: open
            ? "translateY(-50%) rotate(45deg)"
            : `translateY(calc(-50% - ${offset}px)) rotate(0deg)`,
        }}
      />
      <span
        className={bar}
        style={{
          transform: "translateY(-50%) scale(1)",
          opacity: open ? 0 : 1,
        }}
      />
      <span
        className={bar}
        style={{
          transform: open
            ? "translateY(-50%) rotate(-45deg)"
            : `translateY(calc(-50% + ${offset}px)) rotate(0deg)`,
        }}
      />
    </span>
  );
}
