"use client";

import { Check } from "lucide-react";

import { EmptyState } from "@/components/app/states";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  id: string;
  label: string;
  meta?: string;
  checked: boolean;
};

/**
 * Checklist with progress footer (§4.12). Controlled: the parent owns the
 * `items` state and handles each toggle via `onToggle(id)`.
 */
export function Checklist({
  items,
  onToggle,
  readOnly = false,
  className,
}: {
  items: ChecklistItem[];
  onToggle?: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        variant="empty-tab"
        title="Sin checklist"
        description="Esta OT no tiene plantilla aplicada."
        className={className}
      />
    );
  }

  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={cn("flex flex-col", className)}>
      <ul className="flex flex-col">
        {items.map((item) => {
          const id = `ck-${item.id}`;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3 border-b border-dashed border-border py-2.5 last:border-b-0",
              )}
            >
              {readOnly ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border",
                    item.checked
                      ? "border-success bg-success text-white"
                      : "border-border-strong bg-card text-transparent",
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              ) : (
                <Checkbox
                  id={id}
                  checked={item.checked}
                  onCheckedChange={() => onToggle?.(item.id)}
                  className="mt-0.5"
                />
              )}
              <label
                htmlFor={readOnly ? undefined : id}
                className={cn(
                  "flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5",
                  !readOnly && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "flex-1 text-sm",
                    item.checked &&
                      "text-subtle-foreground line-through",
                  )}
                >
                  {item.label}
                </span>
                {item.meta ? (
                  <span className="text-xs text-subtle-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-xs text-subtle-foreground">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
        >
          <div
            aria-hidden
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[11px] font-semibold text-foreground">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}
