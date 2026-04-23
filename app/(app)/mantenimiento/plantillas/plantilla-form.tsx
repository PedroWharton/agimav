"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/app/combobox";
import { NumberInput } from "@/components/app/number-input";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANT_PRIORIDADES } from "@/lib/mantenimiento/estado";

import { createPlantilla, deletePlantilla, updatePlantilla } from "./actions";
import { FRECUENCIA_UNIDADES } from "./types";

export type TipoMaquinariaOpt = {
  id: number;
  nombre: string;
};

export type InventarioLite = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
};

type InsumoDraft = {
  id?: number;
  itemInventarioId: number | null;
  cantidadSugerida: number;
  unidadMedida: string;
};

type TareaDraft = {
  id?: number;
  descripcion: string;
};

export type PlantillaFormInitial = {
  id?: number;
  nombre: string;
  tipoMaquinariaId: number | null;
  frecuenciaValor: number | "";
  frecuenciaUnidad: (typeof FRECUENCIA_UNIDADES)[number];
  prioridad: string;
  descripcion: string;
  insumos: InsumoDraft[];
  tareas: TareaDraft[];
};

export function PlantillaForm({
  mode,
  initial,
  tipos,
  inventario,
  isAdmin,
}: {
  mode: "new" | "edit";
  initial: PlantillaFormInitial;
  tipos: TipoMaquinariaOpt[];
  inventario: InventarioLite[];
  isAdmin: boolean;
}) {
  const tM = useTranslations("mantenimiento");
  const tP = useTranslations("mantenimiento.plantillas");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  const [nombre, setNombre] = useState(initial.nombre);
  const [tipoId, setTipoId] = useState<number | null>(initial.tipoMaquinariaId);
  const [frecuenciaValor, setFrecuenciaValor] = useState<number | "">(
    initial.frecuenciaValor,
  );
  const [frecuenciaUnidad, setFrecuenciaUnidad] = useState(
    initial.frecuenciaUnidad,
  );
  const [prioridad, setPrioridad] = useState(initial.prioridad);
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [insumos, setInsumos] = useState<InsumoDraft[]>(initial.insumos);
  const [tareas, setTareas] = useState<TareaDraft[]>(initial.tareas);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inventarioById = new Map(inventario.map((i) => [i.id, i]));
  const inventarioOptions = inventario.map((i) => ({
    value: String(i.id),
    label: `${i.codigo ? `[${i.codigo}] ` : ""}${i.descripcion ?? "—"}`,
  }));

  const tipoOptions = tipos.map((t) => ({
    value: String(t.id),
    label: t.nombre,
  }));

  const addInsumo = () =>
    setInsumos((prev) => [
      ...prev,
      {
        itemInventarioId: null,
        cantidadSugerida: 0,
        unidadMedida: "",
      },
    ]);

  const updateInsumo = (idx: number, patch: Partial<InsumoDraft>) => {
    setInsumos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeInsumo = (idx: number) =>
    setInsumos((prev) => prev.filter((_, i) => i !== idx));

  const handleInsumoItemChange = (idx: number, idStr: string) => {
    const id = idStr ? Number(idStr) : null;
    if (id == null) {
      updateInsumo(idx, {
        itemInventarioId: null,
        unidadMedida: "",
      });
      return;
    }
    const it = inventarioById.get(id);
    updateInsumo(idx, {
      itemInventarioId: id,
      unidadMedida: it?.unidadMedida ?? "",
    });
  };

  const addTarea = () => {
    const desc = nuevaTarea.trim();
    if (!desc) return;
    setTareas((prev) => [...prev, { descripcion: desc }]);
    setNuevaTarea("");
  };

  const removeTarea = (idx: number) =>
    setTareas((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    setErrors({});
    const payload = {
      nombre,
      tipoMaquinariaId: tipoId,
      frecuenciaValor: frecuenciaValor === "" ? 0 : frecuenciaValor,
      frecuenciaUnidad,
      prioridad,
      descripcion,
      insumos: insumos
        .filter((i) => i.itemInventarioId != null)
        .map((i) => ({
          id: i.id,
          itemInventarioId: i.itemInventarioId as number,
          cantidadSugerida: i.cantidadSugerida,
          unidadMedida: i.unidadMedida,
        })),
      tareas: tareas.map((t) => ({
        id: t.id,
        descripcion: t.descripcion,
      })),
    };
    start(async () => {
      const res =
        mode === "new"
          ? await createPlantilla(payload)
          : await updatePlantilla(initial.id as number, payload);
      if (!res.ok) {
        if ((res.error === "invalid" || res.error === "duplicate") && res.fieldErrors) {
          setErrors(res.fieldErrors);
        } else if (res.error === "forbidden") {
          toast.error(tM("avisos.sinPermisos"));
        } else {
          toast.error(tM("avisos.errorGenerico"));
        }
        return;
      }
      toast.success(
        mode === "new"
          ? tP("avisos.creadaExitosa")
          : tM("avisos.guardadoExitoso"),
      );
      if (mode === "new") {
        router.push(`/mantenimiento/plantillas/${res.id}`);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!initial.id) return;
    startDelete(async () => {
      const res = await deletePlantilla(initial.id as number);
      if (!res.ok) {
        if (res.error === "in_use") {
          toast.error(tP("avisos.enUso"));
        } else if (res.error === "forbidden") {
          toast.error(tM("avisos.sinPermisos"));
        } else {
          toast.error(tM("avisos.errorGenerico"));
        }
        return;
      }
      toast.success(tP("avisos.eliminadaExitosa"));
      router.push("/mantenimiento/plantillas");
      router.refresh();
    });
  };

  const busy = pending || deleting;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/mantenimiento/plantillas">
            <ArrowLeft className="size-4" />
            {tP("volver")}
          </Link>
        </Button>
        <PageHeader
          title={mode === "new" ? tP("nuevaTitulo") : tP("editarTitulo")}
          description={tP("formAyuda")}
          actions={
            mode === "edit" && isAdmin ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={busy}>
                    <Trash2 className="size-4" />
                    {tP("eliminar")}
                  </Button>
                }
                title={tP("avisos.eliminarTitulo")}
                description={tP("avisos.eliminarDescripcion")}
                confirmLabel={tP("eliminar")}
                destructive
                onConfirm={handleDelete}
              />
            ) : null
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tP("campos.nombre")} *</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={200}
          />
          {errors.nombre ? (
            <span className="text-xs text-destructive">{errors.nombre}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tP("campos.tipoMaquinaria")} *</Label>
          <Combobox
            value={tipoId ? String(tipoId) : ""}
            onChange={(v) => setTipoId(v ? Number(v) : null)}
            options={tipoOptions}
            placeholder={tP("campos.tipoMaquinaria")}
            allowCreate={false}
          />
          {errors.tipoMaquinariaId ? (
            <span className="text-xs text-destructive">
              {errors.tipoMaquinariaId}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tP("campos.prioridad")}</Label>
          <Select value={prioridad} onValueChange={setPrioridad}>
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

        <div className="flex flex-col gap-1.5">
          <Label>{tP("campos.frecuenciaValor")} *</Label>
          <NumberInput
            step={0.5}
            min={0}
            value={frecuenciaValor}
            onChange={setFrecuenciaValor}
          />
          {errors.frecuenciaValor ? (
            <span className="text-xs text-destructive">
              {errors.frecuenciaValor}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{tP("campos.frecuenciaUnidad")} *</Label>
          <Select
            value={frecuenciaUnidad}
            onValueChange={(v) =>
              setFrecuenciaUnidad(v as (typeof FRECUENCIA_UNIDADES)[number])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRECUENCIA_UNIDADES.map((u) => (
                <SelectItem key={u} value={u}>
                  {tP(`frecuenciaUnidades.${u}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label>{tP("campos.descripcion")}</Label>
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>

      {/* Insumos */}
      <section className="rounded-md border border-border p-4 max-w-4xl">
        <h2 className="mb-3 text-sm font-semibold">
          {tP("insumos.titulo")}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {tP("insumos.ayuda")}
        </p>
        {insumos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tP("insumos.vacio")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">
                    {tP("insumos.item")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium w-28">
                    {tP("insumos.cantidadSugerida")}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {insumos.map((ins, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-2 py-2">
                      <Combobox
                        value={
                          ins.itemInventarioId
                            ? String(ins.itemInventarioId)
                            : ""
                        }
                        onChange={(v) => handleInsumoItemChange(idx, v)}
                        options={inventarioOptions}
                        placeholder={tP("insumos.item")}
                        allowCreate={false}
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <NumberInput
                        step={0.01}
                        min={0}
                        suffix={ins.unidadMedida || undefined}
                        value={ins.cantidadSugerida || ""}
                        onChange={(v) =>
                          updateInsumo(idx, {
                            cantidadSugerida: v === "" ? 0 : v,
                          })
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={tP("insumos.eliminarLinea")}
                        onClick={() => removeInsumo(idx)}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInsumo}
          >
            <Plus className="size-4" />
            {tP("insumos.agregar")}
          </Button>
        </div>
      </section>

      {/* Tareas */}
      <section className="rounded-md border border-border p-4 max-w-4xl">
        <h2 className="mb-3 text-sm font-semibold">{tP("tareas.titulo")}</h2>
        {tareas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tP("tareas.vacio")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tareas.map((t, idx) => (
              <li
                key={t.id ?? `new-${idx}`}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex-1">{t.descripcion}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tP("tareas.eliminarLinea")}
                  onClick={() => removeTarea(idx)}
                  className="size-6 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            value={nuevaTarea}
            onChange={(e) => setNuevaTarea(e.target.value)}
            placeholder={tP("tareas.placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTarea();
              }
            }}
            className="h-9 max-w-md"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTarea}
            disabled={!nuevaTarea.trim()}
          >
            <Plus className="size-4" />
            {tP("tareas.agregar")}
          </Button>
        </div>
      </section>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}>
          {mode === "new" ? tP("crear") : tM("acciones.guardar")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/mantenimiento/plantillas">
            {tM("acciones.cancelarDialogo")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
