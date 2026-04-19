"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageHeader } from "@/components/app/page-header";
import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

import { saveAsignacion, generarOCs } from "./actions";

export type AsignarLinea = {
  id: number;
  orden: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
  unidadMedida: string | null;
  proveedorAsignadoId: number | null;
};

export type AsignarProveedorOption = {
  id: number;
  nombre: string;
};

export function AsignarClient({
  requisicionId,
  lineas: initialLineas,
  proveedores,
  canMutate,
}: {
  requisicionId: number;
  lineas: AsignarLinea[];
  proveedores: AsignarProveedorOption[];
  canMutate: boolean;
}) {
  const tReq = useTranslations("compras.requisiciones");
  const tCommon = useTranslations("listados.common");
  const tAsig = useTranslations("compras.requisiciones.asignar");
  const router = useRouter();

  const [lineas, setLineas] = useState<AsignarLinea[]>(initialLineas);
  const [bulk, setBulk] = useState<string>("");
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();

  const proveedorOptions = useMemo(
    () =>
      proveedores.map((p) => ({ value: String(p.id), label: p.nombre })),
    [proveedores],
  );
  const proveedorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of proveedores) m.set(p.id, p.nombre);
    return m;
  }, [proveedores]);

  const asignadasCount = lineas.filter(
    (l) => l.proveedorAsignadoId != null,
  ).length;
  const allAssigned = lineas.length > 0 && asignadasCount === lineas.length;

  const groupSummary = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lineas) {
      if (l.proveedorAsignadoId != null) {
        m.set(
          l.proveedorAsignadoId,
          (m.get(l.proveedorAsignadoId) ?? 0) + 1,
        );
      }
    }
    return Array.from(m.entries()).map(([pid, count]) => ({
      nombre: proveedorById.get(pid) ?? `#${pid}`,
      count,
    }));
  }, [lineas, proveedorById]);

  function updateLinea(id: number, proveedorAsignadoId: number | null) {
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, proveedorAsignadoId } : l)),
    );
  }

  function applyBulk(proveedorId: string) {
    setBulk(proveedorId);
    if (!proveedorId) return;
    const pid = Number(proveedorId);
    if (!Number.isFinite(pid)) return;
    setLineas((prev) => prev.map((l) => ({ ...l, proveedorAsignadoId: pid })));
  }

  function buildPayload() {
    return {
      lineas: lineas.map((l) => ({
        detalleId: l.id,
        proveedorId: l.proveedorAsignadoId,
      })),
    };
  }

  function handleSave() {
    startSave(async () => {
      const result = await saveAsignacion(requisicionId, buildPayload());
      if (result.ok) {
        toast.success(tAsig("avisos.guardadoExitoso"));
        router.refresh();
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "wrong_estado") {
        toast.error(tAsig("avisos.estadoIncorrecto"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  function handleGenerate() {
    startGenerate(async () => {
      const saveResult = await saveAsignacion(requisicionId, buildPayload());
      if (!saveResult.ok) {
        toast.error(tCommon("errorGuardar"));
        return;
      }
      const genResult = await generarOCs(requisicionId);
      if (genResult.ok) {
        const count = genResult.ocIds?.length ?? 0;
        toast.success(tAsig("avisos.generadoExitoso", { count }));
        router.push(`/compras/requisiciones/${requisicionId}`);
        router.refresh();
      } else if (genResult.error === "incomplete") {
        toast.error(tAsig("avisos.asignarTodas"));
      } else if (genResult.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (genResult.error === "wrong_estado") {
        toast.error(tAsig("avisos.estadoIncorrecto"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/compras/requisiciones/${requisicionId}`}>
            <ArrowLeft className="size-4" />
            {tReq("volver")}
          </Link>
        </Button>
        <PageHeader
          title={tAsig("titulo", { id: requisicionId })}
          description={tAsig("descripcion")}
          actions={
            canMutate ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving || isGenerating}
                >
                  <Save className="size-4" />
                  {tAsig("acciones.guardarBorrador")}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      disabled={
                        !allAssigned || isSaving || isGenerating
                      }
                    >
                      <Send className="size-4" />
                      {tAsig("acciones.generar")}
                    </Button>
                  }
                  title={tAsig("avisos.generarTitulo", {
                    count: groupSummary.length,
                  })}
                  description={
                    groupSummary.length > 0
                      ? groupSummary
                          .map((g) =>
                            tAsig("avisos.generarLinea", {
                              nombre: g.nombre,
                              count: g.count,
                            }),
                          )
                          .join(" · ")
                      : tAsig("avisos.sinGrupos")
                  }
                  confirmLabel={tAsig("acciones.generar")}
                  onConfirm={handleGenerate}
                />
              </div>
            ) : null
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
        <span className="text-sm text-muted-foreground">
          {tAsig("asignados", {
            asignadas: asignadasCount,
            total: lineas.length,
          })}
        </span>
        {canMutate ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {tAsig("bulk.label")}
            </span>
            <Select value={bulk} onValueChange={applyBulk}>
              <SelectTrigger className="h-9 w-[260px]">
                <SelectValue placeholder={tAsig("bulk.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-10">#</th>
              <th className="px-2 py-2 text-left font-medium w-32">
                {tAsig("columnas.codigo")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tAsig("columnas.descripcion")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-24">
                {tAsig("columnas.cantidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-16">
                {tAsig("columnas.unidad")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tAsig("columnas.proveedor")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">
                  {l.orden}
                </td>
                <td className="px-2 py-2 font-mono text-xs">
                  {l.itemCodigo || "—"}
                </td>
                <td className="px-2 py-2">{l.itemDescripcion || "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {l.cantidad}
                </td>
                <td className="px-2 py-2 text-xs text-muted-foreground">
                  {l.unidadMedida ?? "—"}
                </td>
                <td className="px-2 py-2">
                  <Combobox
                    value={
                      l.proveedorAsignadoId != null
                        ? String(l.proveedorAsignadoId)
                        : ""
                    }
                    onChange={(v) =>
                      updateLinea(l.id, v ? Number(v) : null)
                    }
                    options={proveedorOptions}
                    placeholder={tAsig("seleccionar")}
                    allowCreate={false}
                    disabled={!canMutate}
                    className="h-9"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!allAssigned && lineas.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {tAsig("avisos.asignarTodas")}
        </p>
      ) : null}
    </div>
  );
}
