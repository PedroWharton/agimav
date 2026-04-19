import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MANT_ESTADO_I18N_KEY, type MantEstado } from "@/lib/mantenimiento/estado";

type Tone = "muted" | "sky" | "green" | "destructive";

const TONE_BY_ESTADO: Record<MantEstado, Tone> = {
  Pendiente: "muted",
  "En Reparación - Chacra": "sky",
  "En Reparación - Taller": "sky",
  Finalizado: "green",
  Cancelado: "destructive",
};

const TONE_CLASS: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  sky: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  green:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  destructive: "bg-destructive/10 text-destructive",
};

export function MantEstadoChip({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const t = useTranslations("mantenimiento.estados");
  const tone = (TONE_BY_ESTADO as Record<string, Tone>)[estado] ?? "muted";
  const key = (MANT_ESTADO_I18N_KEY as Record<string, string>)[estado];
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
