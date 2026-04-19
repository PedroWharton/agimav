"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MaquinariaCombobox,
  type MaquinariaOption,
} from "@/components/mantenimiento/maquinaria-combobox";
import { MANT_PRIORIDADES, MANT_TIPOS } from "@/lib/mantenimiento/estado";

import { createMantenimiento } from "../actions";

type UsuarioOpt = { id: number; nombre: string };
type UpOpt = { id: number; nombre: string; localidad: string | null };

export function MantenimientoFormClient({
  maquinarias,
  usuarios,
  unidadesProductivas,
}: {
  maquinarias: MaquinariaOption[];
  usuarios: UsuarioOpt[];
  unidadesProductivas: UpOpt[];
}) {
  const tM = useTranslations("mantenimiento");
  const tTipos = useTranslations("mantenimiento.tipos");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [maquinariaId, setMaquinariaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<(typeof MANT_TIPOS)[number]>("correctivo");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [unidadProductivaId, setUnidadProductivaId] = useState<number | null>(null);
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [prioridad, setPrioridad] =
    useState<(typeof MANT_PRIORIDADES)[number]>("Media");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        prioridad,
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
      toast.success(tM("avisos.creadoExitoso"));
      router.push(`/mantenimiento/${res.id}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/mantenimiento">
            <ArrowLeft className="size-4" />
            {tM("index.volver")}
          </Link>
        </Button>
        <PageHeader
          title={tM("nuevo.titulo")}
          description={tM("nuevo.descripcion")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <div className="flex flex-col gap-1.5">
          <Label>{tM("campos.maquina")} *</Label>
          <MaquinariaCombobox
            value={maquinariaId}
            onChange={setMaquinariaId}
            options={maquinarias}
            placeholder={tM("campos.maquina")}
          />
          {errors.maquinariaId ? (
            <span className="text-xs text-destructive">{errors.maquinariaId}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tM("campos.tipo")} *</Label>
          <Select
            value={tipo}
            onValueChange={(v) =>
              setTipo(v as (typeof MANT_TIPOS)[number])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANT_TIPOS.map((v) => (
                <SelectItem key={v} value={v}>
                  {tTipos(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tM("campos.descripcion")}</Label>
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>

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
            <span className="text-xs text-destructive">{errors.responsableId}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tM("campos.unidadProductiva")}</Label>
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
            placeholder={tM("campos.unidadProductiva")}
            allowCreate={false}
          />
        </div>

        {tipo === "preventivo" ? (
          <div className="flex flex-col gap-1.5">
            <Label>{tM("campos.fechaProgramada")}</Label>
            <Input
              type="date"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
            />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-muted-foreground"
          >
            {showAdvanced ? "− " : "+ "}
            {tM("nuevo.opcionesAvanzadas")}
          </Button>
        </div>

        {showAdvanced ? (
          <div className="flex flex-col gap-1.5">
            <Label>{tM("campos.prioridad")}</Label>
            <Select
              value={prioridad}
              onValueChange={(v) =>
                setPrioridad(v as (typeof MANT_PRIORIDADES)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANT_PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {tM("nuevo.crear")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/mantenimiento">{tM("index.volver")}</Link>
        </Button>
      </div>
    </div>
  );
}
