import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EstadoTone = "muted" | "amber" | "sky" | "green" | "destructive";

const TONE_BY_ESTADO: Record<string, EstadoTone> = {
  // Requisición
  Borrador: "muted",
  "En Revisión": "amber",
  Aprobada: "sky",
  "Asignado a Proveedor": "sky",
  "OC Emitida": "sky",
  Rechazada: "destructive",
  // Orden de Compra
  Emitida: "sky",
  "Parcialmente Recibida": "amber",
  Completada: "green",
  Cancelada: "destructive",
  // Línea de requisición
  Pendiente: "muted",
  "Vinculada OC": "sky",
};

const I18N_KEY_BY_ESTADO: Record<string, string> = {
  Borrador: "Borrador",
  "En Revisión": "EnRevision",
  Aprobada: "Aprobada",
  "Asignado a Proveedor": "AsignadoAProveedor",
  "OC Emitida": "OCEmitida",
  Rechazada: "Rechazada",
  Emitida: "Emitida",
  "Parcialmente Recibida": "ParcialmenteRecibida",
  Completada: "Completada",
  Cancelada: "Cancelada",
  Pendiente: "Pendiente",
  "Vinculada OC": "VinculadaOC",
};

const TONE_CLASS: Record<EstadoTone, string> = {
  muted: "bg-muted text-muted-foreground",
  amber:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  sky: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  green:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  destructive: "bg-destructive/10 text-destructive",
};

export function EstadoChip({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const t = useTranslations("compras.common.estados");
  const tone = TONE_BY_ESTADO[estado] ?? "muted";
  const key = I18N_KEY_BY_ESTADO[estado];
  const label = key ? t(key) : estado;
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
