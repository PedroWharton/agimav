import type { ReactNode } from "react";

import { InlineState } from "@/components/app/states";
import { cn } from "@/lib/utils";

export type TimelineEventType =
  | "create"
  | "status"
  | "note"
  | "stock"
  | "file";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  at: Date;
  actor: string;
  payload: ReactNode;
};

const DOT_BY_TYPE: Record<TimelineEventType, string> = {
  create: "bg-info",
  status: "bg-brand",
  note: "bg-muted-foreground",
  stock: "bg-warn",
  file: "bg-success",
};

const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

function timeAgo(date: Date, now: Date = new Date()): string {
  const deltaSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return rtf.format(Math.round(deltaSec), "second");
  if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(deltaSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(deltaSec / 86400), "day");
  if (abs < 86400 * 30)
    return rtf.format(Math.round(deltaSec / (86400 * 7)), "week");
  if (abs < 86400 * 365)
    return rtf.format(Math.round(deltaSec / (86400 * 30)), "month");
  return rtf.format(Math.round(deltaSec / (86400 * 365)), "year");
}

/**
 * Bitácora timeline (§4.12). Vertical rail with typed colored dots. Payload
 * can be any ReactNode — parent pages build entity references etc.
 */
export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  if (events.length === 0) {
    return (
      <InlineState mark="—" className={className}>
        Sin eventos registrados
      </InlineState>
    );
  }

  return (
    <ol className={cn("relative flex flex-col gap-3 pl-6", className)}>
      <span
        aria-hidden
        className="absolute bottom-3 left-[7px] top-3 w-px bg-border"
      />
      {events.map((event) => (
        <li
          key={event.id}
          className="relative flex flex-col gap-1 py-1"
        >
          <span
            aria-hidden
            className={cn(
              "absolute left-[-18px] top-2 grid size-3 place-items-center rounded-full ring-2 ring-card",
              DOT_BY_TYPE[event.type],
            )}
          />
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {event.actor}
            </span>
            <span
              className="ml-auto font-mono text-[10.5px] text-subtle-foreground"
              title={event.at.toISOString()}
            >
              {timeAgo(event.at)}
            </span>
          </div>
          <div className="text-sm leading-relaxed text-subtle-foreground">
            {event.payload}
          </div>
        </li>
      ))}
    </ol>
  );
}
