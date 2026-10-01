"use client";

import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import Image from "next/image";
import { useState } from "react";

/** Small easter egg on the brand mark - hovering spins the emblem once and
 * pops up a short, playful maritime-themed message, freshly picked each
 * time. Purely decorative - a bit of personality on the one element
 * that's on every single page. */
const HOVER_MESSAGES = ["Smooth sailing ⚓", "Full steam ahead 🚢", "On time, every time"];

export function BrandMark({ imageClassName = "w-8 h-8" }: { imageClassName?: string }) {
  const [hovering, setHovering] = useState(false);
  const [message, setMessage] = useState(HOVER_MESSAGES[0]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        setMessage(HOVER_MESSAGES[Math.floor(Math.random() * HOVER_MESSAGES.length)]);
        setHovering(true);
      }}
      onMouseLeave={() => setHovering(false)}
    >
      <Image
        src="/logo.png"
        alt="I.S. Sea & Air"
        width={79}
        height={79}
        className={`object-contain ${imageClassName} ${hovering ? "animate-brand-spin" : ""}`}
      />
      {/* Anchored to the icon's own left edge, not centered - the logo
          sits close enough to the left edge of the viewport (sidebar
          padding / mobile top bar) that a centered bubble would run off
          screen to the left. Growing rightward always has room. */}
      <span
        className={cn(
          TOOLTIP_BUBBLE_CLASS,
          "pointer-events-none absolute left-0 top-full z-50 mt-2 transition-all duration-200 motion-reduce:transition-none",
          hovering ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        )}
      >
        {message}
      </span>
    </span>
  );
}
