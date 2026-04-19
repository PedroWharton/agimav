import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { PriceDiscrepancy } from "@/lib/compras/price-discrepancy";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<PriceDiscrepancy, string> = {
  none: "",
  match:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  soft: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  hard: "bg-destructive/10 text-destructive",
  noReference: "bg-muted text-muted-foreground",
};

export function PriceDiscrepancyBadge({
  kind,
  className,
}: {
  kind: PriceDiscrepancy;
  className?: string;
}) {
  const t = useTranslations("compras.facturas.discrepancia");
  if (kind === "none") return null;
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", TONE_CLASS[kind], className)}
    >
      {t(kind)}
    </Badge>
  );
}
