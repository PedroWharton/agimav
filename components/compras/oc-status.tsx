import { useTranslations } from "next-intl";

import { StatusChip } from "@/components/app/status-chip";
import { Progress } from "@/components/ui/progress";
import { OC_ESTADO_META, isOcEstado } from "@/lib/compras/oc-estado";
import { cn } from "@/lib/utils";

export function OcStatus({
  estado,
  showProgress = true,
  className,
}: {
  estado: string;
  showProgress?: boolean;
  className?: string;
}) {
  const t = useTranslations("compras.common.estados");

  if (!isOcEstado(estado)) {
    return <StatusChip tone="neutral" label={estado} className={className} />;
  }

  const meta = OC_ESTADO_META[estado];
  return (
    <div className={cn("flex min-w-[120px] flex-col gap-1.5", className)}>
      <StatusChip tone={meta.tone} label={t(meta.i18nKey)} />
      {showProgress && meta.progress !== null ? (
        <Progress value={meta.progress} className="h-1" />
      ) : null}
    </div>
  );
}
