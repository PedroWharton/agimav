import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type InlineErrorProps = {
  message: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

function DefaultIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

/**
 * Compact one-line error for inline contexts (e.g. a failed field load, a
 * partial panel). Renders on `--danger-weak` with a retry slot.
 */
export function InlineError({
  message,
  description,
  action,
  icon,
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg bg-danger-weak px-4 py-3 text-[12.5px] text-danger",
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 text-danger">{icon ?? <DefaultIcon />}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-medium text-danger">{message}</div>
        {description ? (
          <p className="text-[12.5px] text-danger/85">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
