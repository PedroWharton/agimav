import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type InlineStateProps = {
  mark?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Compact centered state for cells / small panels. Optional uppercase mono
 * "mark" prefix (e.g. `— · sin datos · —`).
 */
export function InlineState({ mark, children, className }: InlineStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-7 text-center text-[12.5px] text-muted-foreground",
        className,
      )}
    >
      {mark ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          {mark}
        </span>
      ) : null}
      {children ? <div className="max-w-[280px]">{children}</div> : null}
    </div>
  );
}
