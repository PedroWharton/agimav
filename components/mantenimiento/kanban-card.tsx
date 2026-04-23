"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type PrioridadNivel = "Alta" | "Media" | "Baja";

export type KanbanCardProps = {
  id: number;
  tipo: string;
  maquinaria: string;
  responsable: string;
  prioridad?: string | null;
  /** ISO date string — fechaProgramada or fechaInicio. */
  dueDate?: string | null;
  tareasTotal?: number;
  tareasRealizadas?: number;
};

const PRIORIDAD_DOT: Record<PrioridadNivel, string> = {
  Alta: "bg-danger ring-danger-weak",
  Media: "bg-warn ring-warn-weak",
  Baja: "bg-muted-foreground/60 ring-muted",
};

function normalizePrioridad(raw?: string | null): PrioridadNivel {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.startsWith("alt")) return "Alta";
  if (value.startsWith("baj")) return "Baja";
  return "Media";
}

function dueClassification(iso?: string | null): {
  diffDays: number;
  tone: "neutral" | "warn" | "danger";
} | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const tone: "neutral" | "warn" | "danger" =
    diffDays < 0 ? "danger" : diffDays <= 3 ? "warn" : "neutral";
  return { diffDays, tone };
}

export function KanbanCard({
  id,
  tipo,
  maquinaria,
  responsable,
  prioridad,
  dueDate,
  tareasTotal = 0,
  tareasRealizadas = 0,
}: KanbanCardProps) {
  const t = useTranslations("mantenimiento.tablero");
  const tTipos = useTranslations("mantenimiento.tipos");

  const nivel = normalizePrioridad(prioridad);
  const due = dueClassification(dueDate);
  const tipoKey = tipo as "correctivo" | "preventivo";
  const tipoLabel =
    tipoKey === "correctivo" || tipoKey === "preventivo"
      ? tTipos(tipoKey)
      : tipo;

  let dueText: string | null = null;
  if (due) {
    if (due.diffDays < 0) {
      dueText = t("vencidoHace", { days: -due.diffDays });
    } else if (due.diffDays === 0) {
      dueText = t("venceHoy");
    } else {
      dueText = t("venceEn", { days: due.diffDays });
    }
  } else {
    dueText = t("sinFecha");
  }

  const hasProgress = tareasTotal > 0;
  const progressPct = hasProgress
    ? Math.round((tareasRealizadas / tareasTotal) * 100)
    : 0;

  return (
    <Link
      href={`/mantenimiento/${id}`}
      className={cn(
        "group flex flex-col gap-1.5 rounded-[10px] border border-border bg-card p-3 text-left",
        "transition-colors hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-muted-foreground">
          #{id}
        </span>
        <span
          aria-label={t("prioridad", { nivel })}
          title={t("prioridad", { nivel })}
          className={cn(
            "inline-block size-1.5 rounded-full ring-[3px]",
            PRIORIDAD_DOT[nivel],
          )}
        />
      </div>

      <div className="text-[13.5px] font-medium leading-snug text-foreground">
        {maquinaria}
      </div>

      <div className="text-xs capitalize text-muted-foreground">
        {tipoLabel}
      </div>

      {hasProgress ? (
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${progressPct}%` }}
              aria-hidden
            />
          </div>
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {t("tareas", { done: tareasRealizadas, total: tareasTotal })}
          </span>
        </div>
      ) : null}

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2 text-[11.5px] text-muted-foreground">
        <span className="truncate">{responsable}</span>
        {dueText ? (
          <span
            className={cn(
              "font-mono tabular-nums",
              due?.tone === "danger" && "text-danger",
              due?.tone === "warn" && "text-warn",
            )}
          >
            {dueText}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
