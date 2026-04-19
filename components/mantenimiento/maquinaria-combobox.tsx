"use client";

import { useMemo } from "react";

import { Combobox } from "@/components/app/combobox";

export type MaquinariaOption = {
  id: number;
  tipoNombre: string;
  nroSerie: string;
  principal: string | null;
};

export function MaquinariaCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  options: MaquinariaOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const comboOptions = useMemo(
    () =>
      options.map((o) => ({
        value: String(o.id),
        label: formatLabel(o),
      })),
    [options],
  );

  return (
    <Combobox
      value={value == null ? "" : String(value)}
      onChange={(v) => onChange(v ? Number(v) : null)}
      options={comboOptions}
      placeholder={placeholder ?? "Seleccionar máquina…"}
      searchPlaceholder="Buscar por N° de serie, tipo o identificador…"
      allowCreate={false}
      disabled={disabled}
      className={className}
    />
  );
}

function formatLabel(o: MaquinariaOption): string {
  const parts = [o.tipoNombre, o.nroSerie];
  if (o.principal) parts.push(`(${o.principal})`);
  return parts.join(" · ");
}
