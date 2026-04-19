import { Activity, Box, Building2, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type HistorialRow = {
  id: number;
  tipoCambio: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  detalle: string | null;
  fechaCambio: Date | string;
  usuario: string;
};

const ICON_BY_TIPO: Record<string, React.ComponentType<{ className?: string }>> = {
  estado: Activity,
  insumo: Box,
  taller: Building2,
  responsable: User,
  observacion: MessageSquare,
};

export function HistorialTimeline({ rows }: { rows: HistorialRow[] }) {
  const t = useTranslations("mantenimiento.historial");

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t("sinEventos")}
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const aT = new Date(a.fechaCambio).getTime();
    const bT = new Date(b.fechaCambio).getTime();
    return bT - aT;
  });

  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((r) => {
        const Icon = ICON_BY_TIPO[r.tipoCambio] ?? Activity;
        return (
          <li key={r.id} className="flex gap-3 text-sm">
            <div
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{r.usuario}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.fechaCambio), "dd/MM/yyyy HH:mm", {
                    locale: es,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {renderChange(r)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function renderChange(r: HistorialRow): string {
  if (r.tipoCambio === "estado" && r.valorAnterior && r.valorNuevo) {
    return `${r.valorAnterior} → ${r.valorNuevo}`;
  }
  if (r.tipoCambio === "estado" && r.valorNuevo) {
    return `→ ${r.valorNuevo}`;
  }
  if (r.tipoCambio === "taller") {
    return `${r.valorAnterior ?? "—"} → ${r.valorNuevo ?? "—"}`;
  }
  if (r.tipoCambio === "responsable") {
    return `${r.valorAnterior ?? "—"} → ${r.valorNuevo ?? "—"}`;
  }
  return r.detalle ?? "";
}
