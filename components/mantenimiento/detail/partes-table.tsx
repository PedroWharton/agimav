import { EmptyState } from "@/components/app/states";
import { cn } from "@/lib/utils";

export type ParteRow = {
  id: string;
  tecnicoNombre: string;
  fecha: Date;
  horas: number;
  tarea: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatHoras(h: number): string {
  const whole = Math.floor(h);
  const minutes = Math.round((h - whole) * 60);
  if (whole === 0) return `${minutes}m`;
  if (minutes === 0) return `${whole}h`;
  return `${whole}h ${String(minutes).padStart(2, "0")}m`;
}

/**
 * Partes de trabajo table (§4.12). Técnico avatar + name, fecha, horas, tarea;
 * footer totals horas.
 */
export function PartesTable({
  rows,
  className,
}: {
  rows: ParteRow[];
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        variant="empty-tab"
        title="Sin partes registrados"
        description="Todavía no se cargaron partes de trabajo para esta OT."
        className={className}
      />
    );
  }

  const totalHoras = rows.reduce((acc, r) => acc + r.horas, 0);

  return (
    <div className={cn("w-full overflow-hidden", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-subtle-foreground">
            <th className="px-4 py-2">Técnico</th>
            <th className="px-4 py-2">Fecha</th>
            <th className="px-4 py-2">Horas</th>
            <th className="px-4 py-2">Tarea</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-dashed border-border last:border-b-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-weak text-[10.5px] font-semibold text-brand"
                  >
                    {initials(row.tecnicoNombre)}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {row.tecnicoNombre}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-subtle-foreground">
                {formatFecha(row.fecha)}
              </td>
              <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">
                {formatHoras(row.horas)}
              </td>
              <td className="px-4 py-3 text-sm text-subtle-foreground">
                {row.tarea}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted">
            <td
              colSpan={2}
              className="px-4 py-2.5 text-right text-xs font-semibold text-subtle-foreground"
            >
              Total horas
            </td>
            <td
              colSpan={2}
              className="px-4 py-2.5 font-mono text-sm font-semibold text-foreground"
            >
              {formatHoras(totalHoras)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
