"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import type { MaquinariaOption } from "@/components/mantenimiento/maquinaria-combobox";
import {
  FormCard,
  MachineChip,
  PrioritySegmented,
  RepuestosEditor,
  SummarySidebar,
  TypeChooser,
  type InsumoPickerOption,
  type Prioridad,
  type RepuestoLine,
  type SummaryDraft,
  type TypeOption,
} from "@/components/mantenimiento/form";
import { MANT_PRIORIDADES, MANT_TIPOS } from "@/lib/mantenimiento/estado";

import { createMantenimiento, saveInsumos } from "../actions";

type UsuarioOpt = { id: number; nombre: string };
type UpOpt = { id: number; nombre: string; localidad: string | null };
type PlantillaOpt = { id: number; nombre: string; tipoMaquinaria: string };
type InsumoOpt = InsumoPickerOption & { unidadMedida: string };

type ServerPrioridad = (typeof MANT_PRIORIDADES)[number];
type ServerTipo = (typeof MANT_TIPOS)[number];

const PRIORIDAD_TO_SERVER: Record<Prioridad, ServerPrioridad> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

export function MantenimientoFormClient({
  maquinarias,
  usuarios,
  unidadesProductivas,
  plantillas,
  insumos,
}: {
  maquinarias: MaquinariaOption[];
  usuarios: UsuarioOpt[];
  unidadesProductivas: UpOpt[];
  plantillas: PlantillaOpt[];
  insumos: InsumoOpt[];
}) {
  const tM = useTranslations("mantenimiento");
  const tTipos = useTranslations("mantenimiento.tipos");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [maquinariaId, setMaquinariaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<ServerTipo>("correctivo");
  const [plantillaId, setPlantillaId] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [unidadProductivaId, setUnidadProductivaId] = useState<number | null>(
    null,
  );
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [repuestos, setRepuestos] = useState<RepuestoLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showPlantillaPicker = plantillas.length > 0;

  const maquinaById = useMemo(() => {
    const map = new Map<number, MaquinariaOption>();
    for (const m of maquinarias) map.set(m.id, m);
    return map;
  }, [maquinarias]);

  const selectedMaquina = maquinariaId != null ? maquinaById.get(maquinariaId) : undefined;

  const typeOptions: TypeOption[] = [
    {
      value: "correctivo",
      title: tTipos("correctivo"),
      description: "Reparación por falla o novedad detectada en la máquina.",
      icon: <Wrench className="size-3.5" strokeWidth={1.75} />,
    },
    {
      value: "preventivo",
      title: tTipos("preventivo"),
      description: "Checklist programado por horas o calendario.",
      icon: <Sparkles className="size-3.5" strokeWidth={1.75} />,
    },
  ];

  const submit = () => {
    setErrors({});
    start(async () => {
      const res = await createMantenimiento({
        maquinariaId,
        tipo,
        descripcion,
        responsableId,
        unidadProductivaId,
        fechaProgramada,
        prioridad: PRIORIDAD_TO_SERVER[prioridad],
      });
      if (!res.ok) {
        if (res.error === "invalid" && res.fieldErrors) {
          setErrors(res.fieldErrors);
        } else if (res.error === "forbidden") {
          toast.error("No tenés permisos para crear mantenimientos.");
        } else {
          toast.error("No se pudo crear el mantenimiento.");
        }
        return;
      }

      // Persist reserved repuestos (saveInsumos is a separate transactional action).
      const withItem = repuestos.filter((l) => l.insumoId != null);
      if (withItem.length > 0) {
        const lookup = new Map(insumos.map((i) => [i.id, i] as const));
        const lines = withItem.map((l) => {
          const src = lookup.get(l.insumoId as number);
          return {
            itemInventarioId: l.insumoId as number,
            cantidadSugerida: l.qty,
            cantidadUtilizada: 0,
            unidadMedida: src?.unidadMedida ?? "",
            costoUnitario: l.unitCost ?? src?.unitCost ?? 0,
          };
        });
        const insumosRes = await saveInsumos(res.id, { lines });
        if (!insumosRes.ok) {
          toast.error(
            "OT creada, pero no se pudieron reservar los repuestos. Revisá el detalle.",
          );
          router.push(`/mantenimiento/${res.id}`);
          router.refresh();
          return;
        }
      }

      toast.success(tM("avisos.creadoExitoso"));
      router.push(`/mantenimiento/${res.id}`);
      router.refresh();
    });
  };

  const summaryDraft: SummaryDraft = {
    tipo: tipo ? tTipos(tipo) : undefined,
    prioridad,
    maquina: selectedMaquina
      ? {
          codigo: selectedMaquina.nroSerie,
          descripcion: selectedMaquina.tipoNombre,
        }
      : null,
    repuestos,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/mantenimiento">
            <ArrowLeft className="size-4" />
            {tM("nuevo.volver")}
          </Link>
        </Button>
        <PageHeader
          title={tM("nuevo.titulo")}
          description={tM("nuevo.descripcion")}
        />
      </div>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          {/* 1 · Máquina */}
          <FormCard
            step={1}
            title={tM("nuevo.secciones.maquina")}
            hint={tM("nuevo.requerido")}
          >
            <MachineChip
              machine={
                selectedMaquina
                  ? {
                      id: selectedMaquina.id,
                      codigo: selectedMaquina.nroSerie,
                      descripcion: selectedMaquina.tipoNombre,
                    }
                  : null
              }
              options={maquinarias}
              onChange={(id) => setMaquinariaId(id)}
            />
            {errors.maquinariaId ? (
              <span className="text-xs text-destructive">{errors.maquinariaId}</span>
            ) : null}
          </FormCard>

          {/* 2 · Tipo */}
          <FormCard
            step={2}
            title={tM("nuevo.secciones.tipo")}
            hint={tM("nuevo.requerido")}
          >
            <TypeChooser<ServerTipo>
              options={typeOptions}
              value={tipo}
              onChange={(v) => setTipo(v)}
            />
            {showPlantillaPicker ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>{tM("nuevo.plantilla.label")}</Label>
                  <span className="text-[11px] font-medium text-subtle-foreground">
                    {tM("nuevo.plantilla.info")}
                  </span>
                </div>
                <Combobox
                  value={plantillaId ? String(plantillaId) : ""}
                  onChange={(v) => setPlantillaId(v ? Number(v) : null)}
                  options={[
                    { value: "", label: tM("nuevo.plantilla.placeholder") },
                    ...plantillas.map((p) => ({
                      value: String(p.id),
                      label: `${p.nombre} · ${p.tipoMaquinaria}`,
                    })),
                  ]}
                  placeholder={tM("nuevo.plantilla.placeholder")}
                  allowCreate={false}
                />
                <p className="text-xs text-subtle-foreground">
                  {tM("nuevo.plantilla.ayuda")}
                </p>
              </div>
            ) : null}
          </FormCard>

          {/* 3 · Descripción */}
          <FormCard
            step={3}
            title={tM("nuevo.secciones.descripcion")}
            hint={tM("nuevo.opcional")}
          >
            <div className="flex flex-col gap-1.5">
              <Label>{tM("nuevo.descripcionLabel")}</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={tM("nuevo.descripcionPlaceholder")}
              />
              {errors.descripcion ? (
                <span className="text-xs text-destructive">
                  {errors.descripcion}
                </span>
              ) : null}
            </div>
          </FormCard>

          {/* 4 · Repuestos */}
          <FormCard
            step={4}
            title={tM("nuevo.secciones.repuestos")}
            hint={tM("nuevo.hints.repuestos")}
          >
            <RepuestosEditor
              lines={repuestos}
              onChange={setRepuestos}
              insumoOptions={insumos}
            />
          </FormCard>

          {/* 5 · Asignación */}
          <FormCard
            step={5}
            title={tM("nuevo.secciones.asignacion")}
            hint={tM("nuevo.requerido")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.responsable")} *</Label>
                <Combobox
                  value={responsableId ? String(responsableId) : ""}
                  onChange={(v) => setResponsableId(v ? Number(v) : null)}
                  options={usuarios.map((u) => ({
                    value: String(u.id),
                    label: u.nombre,
                  }))}
                  placeholder={tM("campos.responsable")}
                  allowCreate={false}
                />
                {errors.responsableId ? (
                  <span className="text-xs text-destructive">
                    {errors.responsableId}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.prioridad")}</Label>
                <div>
                  <PrioritySegmented value={prioridad} onChange={setPrioridad} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.unidadProductiva")}</Label>
                <Combobox
                  value={
                    unidadProductivaId ? String(unidadProductivaId) : ""
                  }
                  onChange={(v) =>
                    setUnidadProductivaId(v ? Number(v) : null)
                  }
                  options={[
                    { value: "", label: "—" },
                    ...unidadesProductivas.map((u) => ({
                      value: String(u.id),
                      label: u.localidad
                        ? `${u.nombre} (${u.localidad})`
                        : u.nombre,
                    })),
                  ]}
                  placeholder={tM("campos.unidadProductiva")}
                  allowCreate={false}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{tM("campos.fechaProgramada")}</Label>
                <Input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                />
              </div>
            </div>
          </FormCard>
        </div>

        <SummarySidebar draft={summaryDraft} />
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
        <span className="inline-flex items-center gap-2 text-xs text-subtle-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-warn" />
          {tM("nuevo.dirty")}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/mantenimiento">{tM("nuevo.cancelar")}</Link>
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {tM("nuevo.crear")}
          </Button>
        </div>
      </div>
    </div>
  );
}
