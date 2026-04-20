"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ReceiveBulkBarProps = {
  selectedCount: number;
  onReceiveAll: () => void;
  onClear: () => void;
  className?: string;
};

export function ReceiveBulkBar({
  selectedCount,
  onReceiveAll,
  onClear,
  className,
}: ReceiveBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card
      size="sm"
      role="toolbar"
      aria-label="Acciones de selección"
      className={cn(
        "fixed bottom-4 left-1/2 z-20 -translate-x-1/2 flex-row items-center gap-3 px-4 py-2 shadow-lg",
        className,
      )}
    >
      <span className="text-[12.5px] font-medium">
        <span className="font-mono tabular-nums">{selectedCount}</span>{" "}
        seleccionadas
      </span>
      <Button type="button" size="sm" onClick={onReceiveAll}>
        Recibir todo
      </Button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Limpiar selección"
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </Card>
  );
}
