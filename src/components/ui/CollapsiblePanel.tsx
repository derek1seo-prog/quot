"use client";

import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

/** Shared "+ 추가" trigger -> grow-open form panel pattern (extracted from
 * AddCustomerForm.tsx/AddSalesRepForm.tsx, previously a near-identical
 * ~34-line block duplicated in both). The trigger button collapses away
 * as the panel grows open, animated via a 0fr -> 1fr grid-template-rows
 * transition - animating to/from an unknown content height needs the
 * browser to size the track, not a guessed pixel value. Callers own
 * `open` state and their own form fields/submit logic as `children`. */
export function CollapsiblePanel({
  open,
  onTrigger,
  triggerLabel,
  children,
}: {
  open: boolean;
  onTrigger: () => void;
  triggerLabel: string;
  children: ReactNode;
}) {
  return (
    <div>
      {/* Trigger button - collapses away as the panel opens */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden pt-1 -mt-1">
          <div
            inert={open || undefined}
            className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
              open ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0 delay-100"
            }`}
          >
            <Button onClick={onTrigger} icon={<Plus size={16} />}>
              {triggerLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Form panel - grows open via a 0fr -> 1fr grid-template-rows
       * transition, since animating to/from an unknown content height
       * needs the browser to size the track, not a guessed pixel value. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            inert={!open || undefined}
            className={`bg-white border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 space-y-4 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
              open ? "opacity-100 translate-y-0 delay-100" : "opacity-0 -translate-y-1"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
