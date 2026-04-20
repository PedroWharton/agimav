"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import {
  FormCard,
  PrioritySegmented,
  type Prioridad,
} from "@/components/mantenimiento/form";

import { createOT, updateOT } from "./actions";
import { type OtPrioridad } from "./types";

export type OtFormInitial = {
  id?: number;
  titulo: string;
  descripcionTrabajo: string;
  localidadId: number | null;
  unidadProductivaId: number | null;
  solicitanteId: number | null;
  responsableId: number | null;
  prioridad: OtPrioridad;
  observaciones: string;
};

export type UsuarioOpt = { id: number; nombre: string };
export type LocalidadOpt = { id: number; nombre: string };
export type UpOpt = { id: number; nombre: string; localidad: string | null };

const PRIORIDAD_TO_SERVER: Record<Prioridad, OtPrioridad> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

const PRIORIDAD_FROM_SERVER: Record<OtPrioridad, Prioridad> = {
  Baja: "baja",
  Media: "media",
  Alta: "alta",
};

export function OtForm({
  mode,
  initial,
  usuarios,
  localidades,
  unidadesProductivas,
  readOnly,
}: {
  mode: "new" | "edit";
  initial: OtFormInitial;
  usuarios: UsuarioOpt[];
  localidades: LocalidadOpt[];
  unidadesProductivas: UpOpt[];
  readOnly?: boolean;
}) {
  const tO = useTranslations("ordenesTrabajo");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [titulo, setTitulo] = useState(initial.titulo);
  const [descripcionTrabajo, setDescripcionTrabajo] = useState(
    initial.descripcionTrabajo,
  );
  const [localidadId, setLocalidadId] = useState<number | null>(
    initial.localidadId,
  );
  const [unidadProductivaId, setUnidadProductivaId] = useState<number | null>(
    initial.unidadProductivaId,
  );
  const [solicitanteId, setSolicitanteId] = useState<number | null>(
    initial.solicitanteId,
  );
  const [responsableId, setResponsableId] = useState<number | null>(
    initial.responsableId,
  );
  const [prioridad, setPrioridad] = useState<Prioridad>(
    PRIORIDAD_FROM_SERVER[initial.prioridad] ?? "media",
  );
  const [observaciones, setObservaciones] = useState(initial.observaciones);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    setErrors({});
    if (!titulo.trim()) {
      setErrors({ titulo: tO("avisos.campoRequerido") });
      return;
    }
    start(async () => {
      const payload = {
        titulo,
        descripcionTrabajo,
        localidadId,
        unidadProductivaId,
        solicitanteId,
        responsableId,
        prioridad: PRIORIDAD_TO_SERVER[prioridad],
        observaciones,
      };
      const res =
        mode === "new"
          ? await createOT(payload)
          : await updateOT(initial.id as number, payload);
      if (!res.ok) {
        if (res.error === "invalid" && res.fieldErrors) {
          setErrors(res.fieldErrors);
          return;
        }
        if (res.error === "forbidden") {
          toast.error(tO("avisos.sinPermisos"));
          return;
        }
        if (res.error === "wrong_estado") {
          toast.error(tO("avisos.cerrada"));
          return;
        }
        toast.error(tO("avisos.errorGenerico"));
        return;
      }
      toast.success(
        mode === "new"
          ? tO("avisos.creadaExitosa")
          : tO("avisos.actualizadaExitosa"),
      );
      if (mode === "new") {
        router.push(`/ordenes-trabajo/${res.id}`);
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/ordenes-trabajo">
            <ArrowLeft className="size-4" />
            {tO("volver")}
          </Link>
        </Button>
        <PageHeader
          title={mode === "new" ? tO("nuevaTitulo") : tO("editarTitulo")}
          description={tO("formAyuda")}
        />
      </div>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          {/* 1 · Título + descripción */}
          <FormCard step={1} title={tO("campos.titulo")}>
            <div className="flex flex-col gap-1.5">
              <Label>{tO("campos.titulo")} *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                disabled={readOnly}
              />
              {errors.titulo ? (
                <span className="text-xs text-destructive">
                  {errors.titulo}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tO("campos.descripcionTrabajo")}</Label>
              <Textarea
                value={descripcionTrabajo}
                onChange={(e) => setDescripcionTrabajo(e.target.value)}
                rows={4}
                maxLength={2000}
                disabled={readOnly}
              />
            </div>
          </FormCard>

          {/* 2 · Responsables */}
          <FormCard step={2} title={tO("secciones.responsables")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.solicitante")}</Label>
                <Combobox
                  value={solicitanteId ? String(solicitanteId) : ""}
                  onChange={(v) => setSolicitanteId(v ? Number(v) : null)}
                  options={[
                    { value: "", label: "—" },
                    ...usuarios.map((u) => ({
                      value: String(u.id),
                      label: u.nombre,
                    })),
                  ]}
                  placeholder={tO("campos.solicitante")}
                  allowCreate={false}
                  disabled={readOnly}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.responsable")}</Label>
                <Combobox
                  value={responsableId ? String(responsableId) : ""}
                  onChange={(v) => setResponsableId(v ? Number(v) : null)}
                  options={[
                    { value: "", label: "—" },
                    ...usuarios.map((u) => ({
                      value: String(u.id),
                      label: u.nombre,
                    })),
                  ]}
                  placeholder={tO("campos.responsable")}
                  allowCreate={false}
                  disabled={readOnly}
                />
              </div>
            </div>
          </FormCard>

          {/* 3 · Ubicación */}
          <FormCard step={3} title={tO("campos.localidad")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.localidad")}</Label>
                <Combobox
                  value={localidadId ? String(localidadId) : ""}
                  onChange={(v) => setLocalidadId(v ? Number(v) : null)}
                  options={[
                    { value: "", label: "—" },
                    ...localidades.map((l) => ({
                      value: String(l.id),
                      label: l.nombre,
                    })),
                  ]}
                  placeholder={tO("campos.localidad")}
                  allowCreate={false}
                  disabled={readOnly}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.unidadProductiva")}</Label>
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
                  placeholder={tO("campos.unidadProductiva")}
                  allowCreate={false}
                  disabled={readOnly}
                />
              </div>
            </div>
          </FormCard>

          {/* 4 · Prioridad */}
          <FormCard step={4} title={tO("campos.prioridad")}>
            <PrioritySegmented
              value={prioridad}
              onChange={(v) => (readOnly ? undefined : setPrioridad(v))}
            />
          </FormCard>

          {/* 5 · Observaciones */}
          <FormCard step={5} title={tO("campos.observaciones")}>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={readOnly}
            />
          </FormCard>
        </div>

        {/* Sidebar: resumen simple (sin costos, sin repuestos) */}
        <aside className="sticky top-4 flex flex-col gap-3">
          <Card className="gap-3 p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
              {tO("nuevaTitulo")}
            </h4>
            <SummaryLine
              label={tO("campos.titulo")}
              value={titulo.trim() || null}
            />
            <SummaryLine
              label={tO("campos.prioridad")}
              value={PRIORIDAD_TO_SERVER[prioridad]}
              dotClass={
                prioridad === "alta"
                  ? "bg-danger"
                  : prioridad === "media"
                    ? "bg-warn"
                    : "bg-muted-foreground"
              }
            />
            <SummaryLine
              label={tO("campos.solicitante")}
              value={usuarios.find((u) => u.id === solicitanteId)?.nombre ?? null}
            />
            <SummaryLine
              label={tO("campos.responsable")}
              value={
                usuarios.find((u) => u.id === responsableId)?.nombre ?? null
              }
            />
            <SummaryLine
              label={tO("campos.localidad")}
              value={
                localidades.find((l) => l.id === localidadId)?.nombre ?? null
              }
            />
            <SummaryLine
              label={tO("campos.unidadProductiva")}
              value={
                unidadesProductivas.find((u) => u.id === unidadProductivaId)
                  ?.nombre ?? null
              }
            />
          </Card>
        </aside>
      </section>

      {!readOnly ? (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
          <span className="text-xs text-subtle-foreground">
            {tO("formAyuda")}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/ordenes-trabajo">{tO("volver")}</Link>
            </Button>
            <Button size="sm" onClick={submit} disabled={pending}>
              {mode === "new" ? tO("crear") : tO("guardar")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryLine({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: string | null;
  dotClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-border py-1.5 text-xs last:border-b-0">
      <span className="text-subtle-foreground">{label}</span>
      <span className="text-right font-medium">
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            {dotClass ? (
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", dotClass)}
              />
            ) : null}
            {value}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </span>
    </div>
  );
}
