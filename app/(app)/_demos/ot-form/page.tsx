"use client";

import { Hammer, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import type { MaquinariaOption } from "@/components/mantenimiento/maquinaria-combobox";
import {
  FormCard,
  MachineChip,
  type MachineChipValue,
  PrioritySegmented,
  type Prioridad,
  type InsumoPickerOption,
  type RepuestoLine,
  RepuestosEditor,
  SummarySidebar,
  TypeChooser,
  type TypeOption,
} from "@/components/mantenimiento/form";

type TipoValue = "preventivo" | "correctivo" | "mejora";

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: "preventivo",
    title: "Preventivo",
    description: "Checklist programado por horas / kilómetros.",
    icon: <Sparkles className="size-4" />,
  },
  {
    value: "correctivo",
    title: "Correctivo",
    description: "Reparación por falla o novedad detectada.",
    icon: <Wrench className="size-4" />,
  },
  {
    value: "mejora",
    title: "Mejora",
    description: "Modificación o upgrade sin corregir una falla.",
    icon: <Hammer className="size-4" />,
  },
];

const MACHINES: Array<MaquinariaOption & MachineChipValue> = [
  {
    id: 42,
    tipoNombre: "Retroexcavadora CAT 420F",
    nroSerie: "MAQ-042",
    principal: "Vaca Muerta",
    codigo: "MAQ-042",
    descripcion: "Retroexcavadora CAT 420F",
  },
  {
    id: 57,
    tipoNombre: "Cargadora frontal JCB 3CX",
    nroSerie: "MAQ-057",
    principal: "Taller central",
    codigo: "MAQ-057",
    descripcion: "Cargadora frontal JCB 3CX",
  },
];

const INSUMOS: InsumoPickerOption[] = [
  {
    id: 1,
    sku: "FA-15W40-4L",
    nombre: "Filtro aceite motor 15W40",
    stock: 12,
    unitCost: 48_500,
  },
  {
    id: 2,
    sku: "FC-FLEET-5",
    nombre: "Filtro combustible primario",
    stock: 4,
    unitCost: 26_800,
  },
  {
    id: 3,
    sku: "AC-15W40-20",
    nombre: "Aceite 15W40 x 20L",
    stock: 8,
    unitCost: 184_000,
  },
];

export default function OtFormDemoPage() {
  const [tipo, setTipo] = useState<TipoValue | null>("preventivo");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [maquinaId, setMaquinaId] = useState<number | null>(42);
  const [lines, setLines] = useState<RepuestoLine[]>([]);

  const maquina = useMemo<MachineChipValue | null>(() => {
    const found = MACHINES.find((m) => m.id === maquinaId);
    return found ? { id: found.id, codigo: found.codigo, descripcion: found.descripcion } : null;
  }, [maquinaId]);

  const tipoLabel = tipo
    ? TYPE_OPTIONS.find((o) => o.value === tipo)?.title
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">Demo · OT form primitives</h1>
        <p className="text-sm text-subtle-foreground">
          Validación visual de los 6 componentes de{" "}
          <code className="font-mono text-xs">components/mantenimiento/form</code>.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <FormCard step={1} title="Máquina" hint="Requerido">
            <MachineChip
              machine={maquina}
              options={MACHINES}
              onChange={setMaquinaId}
            />
          </FormCard>

          <FormCard
            step={2}
            title="Tipo de trabajo"
            hint="Determina el flujo y la plantilla"
          >
            <TypeChooser<TipoValue>
              options={TYPE_OPTIONS}
              value={tipo}
              onChange={setTipo}
            />
          </FormCard>

          <FormCard step={3} title="Prioridad">
            <PrioritySegmented value={prioridad} onChange={setPrioridad} />
          </FormCard>

          <FormCard
            step={4}
            title="Repuestos e insumos"
            hint="Opcional · se descuentan del pañol al iniciar"
          >
            <RepuestosEditor
              lines={lines}
              onChange={setLines}
              insumoOptions={INSUMOS}
            />
          </FormCard>
        </div>

        <SummarySidebar
          draft={{
            tipo: tipoLabel,
            prioridad,
            maquina,
            repuestos: lines,
            manoObraEstimadaArs: 48_000,
          }}
        />
      </div>
    </div>
  );
}
