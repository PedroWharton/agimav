"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export type QtyStepperProps = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
};

function clamp(v: number, min: number, max: number | undefined) {
  let next = Number.isFinite(v) ? v : 0;
  if (next < min) next = min;
  if (typeof max === "number" && next > max) next = max;
  return next;
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  size = "md",
  disabled,
  className,
}: QtyStepperProps) {
  const btnSize = size === "sm" ? "size-6" : "size-7";
  const iconSize = size === "sm" ? "size-3" : "size-3.5";
  const inputHeight = size === "sm" ? "h-6" : "h-7";

  const step = (delta: number) => {
    if (disabled) return;
    onChange(clamp((Number(value) || 0) + delta, min, max));
  };

  const handleInput = (raw: string) => {
    if (disabled) return;
    if (raw === "" || raw === "-") {
      onChange(clamp(0, min, max));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(clamp(parsed, min, max));
  };

  const atMin = typeof value === "number" && value <= min;
  const atMax = typeof max === "number" && typeof value === "number" && value >= max;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted-2 p-0.5",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || atMin}
        className={cn(
          btnSize,
          "grid place-items-center rounded bg-muted-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        )}
        aria-label="Disminuir"
      >
        <Minus className={iconSize} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => handleInput(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-16 rounded bg-transparent text-center font-mono text-sm font-semibold tabular-nums text-foreground outline-none",
          inputHeight,
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      />
      <button
        type="button"
        onClick={() => step(+1)}
        disabled={disabled || atMax}
        className={cn(
          btnSize,
          "grid place-items-center rounded bg-muted-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        )}
        aria-label="Aumentar"
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}
