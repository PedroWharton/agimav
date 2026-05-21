"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
 * chip with codigo (mono) + descripcion and a "Cambiar…" button that swaps the
 * chip for the máquina picker inline. When unset, shows the picker directly.
 *
 * The picker is the searchable {@link MaquinariaCombobox} (itself a popover
 * combobox); the parent provides its richer `options` shape. The picker is
 * rendered inline — never wrapped in an extra popover/button — so the user
 * sees a single "Seleccionar máquina" control, not a nested one.
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
  const [editing, setEditing] = useState(false);

  const handleChange = (id: number | null) => {
    if (id != null) {
      onChange(id);
      setEditing(false);
    }
  };

  if (!machine || editing) {
    return (
      <MaquinariaCombobox
        value={machine?.id ?? null}
        onChange={handleChange}
        options={options}
        className={className}
      />
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        Cambiar…
      </Button>
    </div>
  );
}
