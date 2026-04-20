"use client";

import { Card } from "@/components/ui/card";
import { InlineState } from "@/components/app/states";
import { cn } from "@/lib/utils";

import type { Prioridad } from "./priority-segmented";
import type { RepuestoLine } from "./repuestos-editor";

export type SummaryDraft = {
  tipo?: string;
  prioridad?: Prioridad;
  maquina?: { codigo: string; descripcion: string } | null;
  repuestos: RepuestoLine[];
  manoObraEstimadaArs?: number;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

const PRIORIDAD_DOT: Record<Prioridad, string> = {
  baja: "bg-muted-foreground",
  media: "bg-warn",
  alta: "bg-danger",
};

function repuestosSubtotal(lines: RepuestoLine[]): number {
  return lines.reduce(
    (acc, l) => acc + (l.unitCost != null ? l.qty * l.unitCost : 0),
    0,
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-border py-1.5 text-xs last:border-b-0">
      <span className="text-subtle-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

/**
 * Sticky resumen sidebar (§4.11). Two stacked cards: the draft's key/values
 * and the cost breakdown. When the draft is empty, shows an inline nudge.
 */
export function SummarySidebar({
  draft,
  className,
}: {
  draft: SummaryDraft;
  className?: string;
}) {
  const { tipo, prioridad, maquina, repuestos, manoObraEstimadaArs } = draft;
  const repuestosSubtotalArs = repuestosSubtotal(repuestos);
  const manoObra = manoObraEstimadaArs ?? 0;
  const total = manoObra + repuestosSubtotalArs;

  const isEmpty = !tipo && !maquina && repuestos.length === 0;

  return (
    <aside
      className={cn("sticky top-4 flex flex-col gap-3", className)}
      aria-label="Resumen"
    >
      {isEmpty ? (
        <Card className="p-4">
          <InlineState mark="resumen">
            Empezá a completar el formulario para ver el resumen.
          </InlineState>
        </Card>
      ) : (
        <>
          <Card className="gap-3 p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
              Resumen
            </h4>
            <div>
              {maquina ? (
                <SummaryRow label="Máquina">
                  <span className="font-mono text-[11px] text-subtle-foreground">
                    {maquina.codigo}
                  </span>
                  <br />
                  <span>{maquina.descripcion}</span>
                </SummaryRow>
              ) : null}
              {tipo ? <SummaryRow label="Tipo">{tipo}</SummaryRow> : null}
              {prioridad ? (
                <SummaryRow label="Prioridad">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        PRIORIDAD_DOT[prioridad],
                      )}
                    />
                    {PRIORIDAD_LABEL[prioridad]}
                  </span>
                </SummaryRow>
              ) : null}
              <SummaryRow label="Repuestos">
                {repuestos.length === 0
                  ? "— sin repuestos —"
                  : `${repuestos.length} item${repuestos.length === 1 ? "" : "s"}`}
              </SummaryRow>
            </div>
          </Card>

          <Card className="gap-3 p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
              Costo estimado
            </h4>
            <div>
              <SummaryRow label="Mano de obra">
                {manoObraEstimadaArs != null
                  ? ARS.format(manoObraEstimadaArs)
                  : "—"}
              </SummaryRow>
              <SummaryRow label="Repuestos">
                {ARS.format(repuestosSubtotalArs)}
              </SummaryRow>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">Total</span>
              <span className="font-mono text-base font-semibold">
                {ARS.format(total)}
              </span>
            </div>
          </Card>
        </>
      )}
    </aside>
  );
}
