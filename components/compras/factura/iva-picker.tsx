"use client";

import type { JSX } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const IVA_RATES = [0, 10.5, 21, 27] as const;

const IVA_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatIvaLabel(rate: number): string {
  return `${IVA_FORMATTER.format(rate)}%`;
}

export function IvaPicker({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  "aria-label"?: string;
}): JSX.Element {
  // Match the incoming value against the fixed rate set (handle float precision).
  const selected =
    IVA_RATES.find((r) => Math.abs(r - value) < 1e-6) ?? IVA_RATES[2];

  return (
    <Select
      value={String(selected)}
      onValueChange={(next) => onChange(Number(next))}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel ?? "Alícuota IVA"}
        className={cn("min-w-[78px] font-mono text-[12px]", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {IVA_RATES.map((rate) => (
          <SelectItem
            key={rate}
            value={String(rate)}
            className="font-mono text-[12px]"
          >
            {formatIvaLabel(rate)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
