"use client";

import { cn } from "@/lib/utils";

export type Prioridad = "baja" | "media" | "alta";

type Segment = { value: Prioridad; label: string; dotClass: string };

const SEGMENTS: Segment[] = [
  { value: "baja", label: "Baja", dotClass: "bg-muted-foreground" },
  { value: "media", label: "Media", dotClass: "bg-warn" },
  { value: "alta", label: "Alta", dotClass: "bg-danger" },
];

/**
 * 3-segment toggle: baja / media / alta (§4.11). Colored dot + label per
 * segment; the selected pill is lifted onto `bg-card` with a soft shadow.
 */
export function PrioritySegmented({
  value,
  onChange,
  className,
}: {
  value: Prioridad;
  onChange: (p: Prioridad) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Prioridad"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className,
      )}
    >
      {SEGMENTS.map((seg) => {
        const selected = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(seg.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              "text-subtle-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-card text-foreground shadow-sm",
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", seg.dotClass)}
            />
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
