import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ToolbarSearch, ToolbarViewMode } from "./toolbar.client";

/**
 * Generic filter toolbar: search + selects + pill toggles + view-mode segment.
 *
 * Layout (left → right): search (grows), selects, pills, view-mode (pushed to
 * the right via `ml-auto` on `ToolbarViewMode`). Wraps on narrow widths.
 *
 * Visual spec: §4.2 of `docs/redesign-plan.md`; matches `.toolbar` /
 * `.toolbar-right` / `.seg` in `/tmp/design-package/agimav/project/shared.css`.
 */
function ToolbarRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-slot="toolbar"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      {children}
    </section>
  );
}

function ToolbarSelects({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="toolbar-selects"
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

function ToolbarPills({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="toolbar-pills"
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

export const Toolbar = Object.assign(ToolbarRoot, {
  Search: ToolbarSearch,
  Selects: ToolbarSelects,
  Pills: ToolbarPills,
  ViewMode: ToolbarViewMode,
});
