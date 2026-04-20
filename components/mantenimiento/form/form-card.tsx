import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Numbered section card used by the OT create form (§4.11).
 *
 * Renders the step bubble + title + optional hint, then a body slot. Parents
 * own the visible title/hint copy — primitives stay i18n-agnostic.
 */
export function FormCard({
  step,
  title,
  hint,
  children,
  className,
}: {
  step: number;
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-weak text-xs font-semibold text-brand"
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-tight">{title}</h3>
          {hint ? (
            <p className="mt-1 text-xs text-subtle-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 pl-10">{children}</div>
    </Card>
  );
}
