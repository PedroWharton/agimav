import type { JSX } from "react";
import { Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function OcLinkChip({
  ocNumero,
  ocDetalleId,
  className,
}: {
  ocNumero: string;
  ocDetalleId: number;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-info-weak px-2 py-0.5 text-xs font-medium text-info",
        className,
      )}
      title={`Detalle OC #${ocDetalleId}`}
      data-slot="oc-link-chip"
    >
      <Link2 className="size-3" aria-hidden />
      <span className="font-mono">{ocNumero}</span>
    </span>
  );
}
