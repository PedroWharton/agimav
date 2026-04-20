"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { StatusChip, type ChipTone } from "@/components/app/status-chip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Prioridad = "baja" | "media" | "alta";

const PRIORIDAD_META: Record<Prioridad, { label: string; dotClass: string }> = {
  baja: { label: "Prioridad baja", dotClass: "bg-muted-foreground" },
  media: { label: "Prioridad media", dotClass: "bg-warn" },
  alta: { label: "Prioridad alta", dotClass: "bg-danger" },
};

/**
 * Hero strip for the OT detail page (§4.12). Renders identifier + tipo +
 * prioridad + an editable estado pill on the left, title + subtitle in the
 * center, and a caller-controlled actions cluster on the right.
 */
export function OTHero({
  id,
  tipo,
  prioridad,
  estado,
  title,
  subtitle,
  actions,
  className,
}: {
  id: string;
  tipo: { label: string; tone?: ChipTone };
  prioridad: Prioridad;
  estado: { label: string; onChangeRequest?: () => void };
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const pri = PRIORIDAD_META[prioridad];
  const estadoInteractive = typeof estado.onChangeRequest === "function";

  return (
    <Card className={cn("gap-3 p-5", className)}>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
              {id}
            </span>
            <StatusChip tone={tipo.tone ?? "neutral"} label={tipo.label} dot />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-warn-weak px-2.5 py-0.5 text-xs font-semibold text-warn",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", pri.dotClass)}
              />
              {pri.label}
            </span>
            <button
              type="button"
              onClick={estado.onChangeRequest}
              disabled={!estadoInteractive}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                estadoInteractive
                  ? "cursor-pointer hover:bg-brand/90"
                  : "cursor-default",
              )}
              aria-haspopup={estadoInteractive ? "menu" : undefined}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-white/90"
              />
              {estado.label}
              {estadoInteractive ? (
                <ChevronDown aria-hidden className="size-3" />
              ) : null}
            </button>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-subtle-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </Card>
  );
}
