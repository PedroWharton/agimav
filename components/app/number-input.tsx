"use client";

import { forwardRef } from "react";
import { Minus, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number | "";
  onChange: (value: number | "") => void;
  /** Unit label rendered inside the input on the right (e.g. "UNIDAD", "hs"). */
  suffix?: string;
  /** Show +/- stepper buttons flanking the input. */
  steppers?: boolean;
  /** Amount per stepper click. Defaults to `step` or 1. */
  stepAmount?: number;
};

function parseNum(raw: string): number | "" {
  if (raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

function toNum(v: string | number | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      onChange,
      suffix,
      steppers,
      stepAmount,
      className,
      step,
      min,
      max,
      disabled,
      onWheel,
      ...rest
    },
    ref,
  ) {
    const amount = stepAmount ?? toNum(step, 1) ?? 1;
    const minN = toNum(min, Number.NEGATIVE_INFINITY);
    const maxN = toNum(max, Number.POSITIVE_INFINITY);

    const currentN = typeof value === "number" ? value : 0;
    const atMin = typeof value === "number" && value <= minN;
    const atMax = typeof value === "number" && value >= maxN;

    const bump = (delta: number) => {
      if (disabled) return;
      const next = Math.min(maxN, Math.max(minN, currentN + delta));
      const rounded = Number.isFinite(amount)
        ? Math.round(next / amount) * amount
        : next;
      // Avoid floating point drift (e.g. 0.1 + 0.2).
      const display = Number.parseFloat(rounded.toFixed(6));
      onChange(Number.isFinite(display) ? display : next);
    };

    const suffixWidth = suffix
      ? suffix.length <= 2
        ? "pr-9"
        : suffix.length <= 4
          ? "pr-12"
          : "pr-16"
      : "";

    return (
      <div className={cn("relative flex items-center")}>
        {steppers ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => bump(-amount)}
            disabled={disabled || atMin}
            aria-label="Disminuir"
            className="absolute left-0.5 z-10 grid size-7 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus className="size-3.5" />
          </button>
        ) : null}
        <Input
          ref={ref}
          type="number"
          inputMode="decimal"
          step={step ?? "any"}
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onWheel={(e) => {
            // Prevent scroll-wheel from accidentally changing the value while
            // scrolling a form.
            e.currentTarget.blur();
            onWheel?.(e);
          }}
          onChange={(e) => onChange(parseNum(e.target.value))}
          className={cn(
            "text-right tabular-nums",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            steppers && "px-8 text-center",
            !steppers && suffix && suffixWidth,
            className,
          )}
          {...rest}
        />
        {steppers ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => bump(amount)}
            disabled={disabled || atMax}
            aria-label="Aumentar"
            className="absolute right-0.5 z-10 grid size-7 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus className="size-3.5" />
          </button>
        ) : suffix ? (
          <span className="pointer-events-none absolute right-2.5 select-none text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);
