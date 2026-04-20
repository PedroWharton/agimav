"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MaquinariaCombobox,
  type MaquinariaOption,
} from "@/components/mantenimiento/maquinaria-combobox";
import { cn } from "@/lib/utils";

export type MachineChipValue = {
  id: number;
  codigo: string;
  descripcion: string;
};

/**
 * Machine preview pill (§4.11). When a machine is selected, shows a compact
 * chip with codigo (mono) + descripcion and a "Cambiar…" button that opens
 * the máquina picker in a popover. When unset, shows a full-width
 * "Seleccionar máquina" button.
 *
 * The picker reuses the existing {@link MaquinariaCombobox}; the parent is
 * responsible for providing its richer `options` shape.
 */
export function MachineChip({
  machine,
  options,
  onChange,
  className,
}: {
  machine?: MachineChipValue | null;
  options: MaquinariaOption[];
  onChange: (id: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleChange = (id: number | null) => {
    if (id != null) {
      onChange(id);
      setOpen(false);
    }
  };

  if (!machine) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-center", className)}
          >
            Seleccionar máquina
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-2"
          align="start"
        >
          <MaquinariaCombobox
            value={null}
            onChange={handleChange}
            options={options}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs text-subtle-foreground">
          {machine.codigo}
        </div>
        <div className="truncate text-sm font-medium">
          {machine.descripcion}
        </div>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Cambiar…
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="end">
          <MaquinariaCombobox
            value={machine.id}
            onChange={handleChange}
            options={options}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
