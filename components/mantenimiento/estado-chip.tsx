import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MANT_ESTADO_I18N_KEY, type MantEstado } from "@/lib/mantenimiento/estado";

type Tone = "muted" | "info" | "success" | "danger";

const TONE_BY_ESTADO: Record<MantEstado, Tone> = {
  Pendiente: "muted",
  "En Reparación - Chacra": "info",
  "En Reparación - Taller": "info",
  Finalizado: "success",
  Cancelado: "danger",
};

const TONE_CLASS: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-info-weak text-info",
  success: "bg-success-weak text-success",
  danger: "bg-danger-weak text-danger",
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
