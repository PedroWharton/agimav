"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TypeOption = {
  value: string;
  title: string;
  description?: string;
  icon?: ReactNode;
};

/**
 * Radio-card grid (§4.11). Each option is a `<button type="button">` so it's
 * fully keyboard-accessible. The selected card lights up with `ring-2
 * ring-brand bg-brand-weak` plus a check badge in the top-right corner.
 */
export function TypeChooser<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TypeOption[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-selected={selected ? "true" : "false"}
            onClick={() => onChange(opt.value as T)}
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors",
              "hover:border-border-strong",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-brand-weak ring-2 ring-brand",
            )}
          >
            {selected ? (
              <span
                aria-hidden
                className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-brand text-primary-foreground"
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            ) : null}
            <div className="flex items-center gap-2">
              {opt.icon ? (
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md bg-muted text-foreground",
                    selected && "bg-brand text-primary-foreground",
                  )}
                >
                  {opt.icon}
                </span>
              ) : null}
              <span className="text-sm font-semibold">{opt.title}</span>
            </div>
            {opt.description ? (
              <span className="text-xs leading-snug text-subtle-foreground">
                {opt.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
