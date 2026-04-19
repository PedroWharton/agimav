"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";

import { createOT, updateOT } from "./actions";
import { OT_PRIORIDADES, type OtPrioridad } from "./types";

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
  const [prioridad, setPrioridad] = useState<OtPrioridad>(initial.prioridad);
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
        prioridad,
        observaciones,
      };
      const res = mode === "new"
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

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tO("campos.titulo")} *</Label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            disabled={readOnly}
          />
          {errors.titulo ? (
            <span className="text-xs text-destructive">{errors.titulo}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tO("campos.descripcionTrabajo")}</Label>
          <Textarea
            value={descripcionTrabajo}
            onChange={(e) => setDescripcionTrabajo(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={readOnly}
          />
        </div>

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
            value={unidadProductivaId ? String(unidadProductivaId) : ""}
            onChange={(v) => setUnidadProductivaId(v ? Number(v) : null)}
            options={[
              { value: "", label: "—" },
              ...unidadesProductivas.map((u) => ({
                value: String(u.id),
                label: u.localidad ? `${u.nombre} (${u.localidad})` : u.nombre,
              })),
            ]}
            placeholder={tO("campos.unidadProductiva")}
            allowCreate={false}
            disabled={readOnly}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tO("campos.prioridad")}</Label>
          <Select
            value={prioridad}
            onValueChange={(v) => setPrioridad(v as OtPrioridad)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OT_PRIORIDADES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tO("campos.observaciones")}</Label>
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={readOnly}
          />
        </div>
      </div>

      {!readOnly ? (
        <div className="flex gap-2">
          <Button onClick={submit} disabled={pending}>
            {mode === "new" ? tO("crear") : tO("guardar")}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ordenes-trabajo">{tO("volver")}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
