import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type KVPair = {
  label: string;
  value: ReactNode;
};

const COLS_MD: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/**
 * Generic label/value grid for datos generales (§4.12). 2 cols on mobile, up
 * to 4 at md+. Empty `value` renders an em-dash placeholder.
 */
export function KVGrid({
  items,
  columns = 4,
  className,
}: {
  items: KVPair[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4",
        COLS_MD[columns],
        className,
      )}
    >
      {items.map((item, i) => {
        const isEmpty =
          item.value === undefined ||
          item.value === null ||
          item.value === "";
        return (
          <div key={`${item.label}-${i}`} className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-foreground">
              {isEmpty ? (
                <span className="text-subtle-foreground">—</span>
              ) : (
                item.value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
