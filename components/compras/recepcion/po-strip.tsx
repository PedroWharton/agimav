import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ProgressRing } from "./progress-ring";

export type POStripProps = {
  ocNumero: string;
  proveedor: string;
  fechaEmitida: Date;
  totalLineas: number;
  totalUnidades: number;
  unidadesRecibidas: number;
  className?: string;
};

function formatFecha(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function Block({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-[13px] font-medium">{children}</span>
    </div>
  );
}

function Separator() {
  return <div aria-hidden className="h-8 w-px shrink-0 bg-border" />;
}

export function POStrip({
  ocNumero,
  proveedor,
  fechaEmitida,
  totalLineas,
  totalUnidades,
  unidadesRecibidas,
  className,
}: POStripProps) {
  const ratio = totalUnidades > 0 ? unidadesRecibidas / totalUnidades : 0;

  return (
    <Card
      size="sm"
      className={cn(
        "flex flex-row items-center gap-6 px-4 py-4",
        className,
      )}
    >
      <Block label="OC">
        <span className="font-mono text-brand">{ocNumero}</span>
      </Block>
      <Separator />
      <Block label="Proveedor" className="min-w-[160px]">
        {proveedor}
      </Block>
      <Separator />
      <Block label="Emitida">{formatFecha(fechaEmitida)}</Block>
      <Separator />
      <Block label="Líneas">
        <span className="font-mono tabular-nums">{totalLineas}</span>
      </Block>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Unidades
          </span>
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            {unidadesRecibidas}/{totalUnidades}
            <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
              unidades
            </span>
          </span>
        </div>
        <ProgressRing value={ratio} size={48} strokeWidth={5} />
      </div>
    </Card>
  );
}
