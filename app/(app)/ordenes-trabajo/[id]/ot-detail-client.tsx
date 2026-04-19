"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { formatOTNumber } from "@/lib/ot/ot-number";

import { cancelarOT, cerrarOT, saveOtInsumos, updateOT } from "../actions";
import {
  OT_PRIORIDADES,
  otIsActiva,
  otIsTerminal,
  type OtPrioridad,
} from "../types";

type UsuarioOpt = { id: number; nombre: string };
type LocalidadOpt = { id: number; nombre: string };
type UpOpt = { id: number; nombre: string; localidad: string | null };

type InventarioOpt = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  valorUnitario: number;
  stock: number;
};

type OtInsumoRow = {
  id?: number;
  itemInventarioId: number;
  itemCodigo: string | null;
  itemDescripcion: string | null;
  cantidad: number;
  unidadMedida: string | null;
  costoUnitario: number;
  costoTotal: number;
  stockDisponible: number;
};

export type OtDetail = {
  id: number;
  numeroOt: string | null;
  titulo: string;
  descripcionTrabajo: string;
  observaciones: string;
  estado: string;
  prioridad: OtPrioridad;
  fechaCreacion: string;
  fechaFinalizacion: string | null;
  creadoPor: string | null;
  solicitanteId: number | null;
  responsableId: number | null;
  localidadId: number | null;
  unidadProductivaId: number | null;
  insumos: OtInsumoRow[];
};

export function OtDetailClient({
  ot,
  usuarios,
  localidades,
  unidadesProductivas,
  inventario,
}: {
  ot: OtDetail;
  usuarios: UsuarioOpt[];
  localidades: LocalidadOpt[];
  unidadesProductivas: UpOpt[];
  inventario: InventarioOpt[];
}) {
  const tO = useTranslations("ordenesTrabajo");
  const router = useRouter();
  const [pendingHeader, startHeader] = useTransition();
  const [pendingInsumos, startInsumos] = useTransition();
  const [pendingAction, startAction] = useTransition();

  const numero = ot.numeroOt ?? formatOTNumber(ot.id);
  const terminal = otIsTerminal(ot.estado);
  const activa = otIsActiva(ot.estado);

  const [editOpen, setEditOpen] = useState(false);
  const [titulo, setTitulo] = useState(ot.titulo);
  const [descripcionTrabajo, setDescripcionTrabajo] = useState(
    ot.descripcionTrabajo,
  );
  const [observaciones, setObservaciones] = useState(ot.observaciones);
  const [solicitanteId, setSolicitanteId] = useState<number | null>(
    ot.solicitanteId,
  );
  const [responsableId, setResponsableId] = useState<number | null>(
    ot.responsableId,
  );
  const [localidadId, setLocalidadId] = useState<number | null>(ot.localidadId);
  const [unidadProductivaId, setUnidadProductivaId] = useState<number | null>(
    ot.unidadProductivaId,
  );
  const [prioridad, setPrioridad] = useState<OtPrioridad>(ot.prioridad);
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

  const [insumosDraft, setInsumosDraft] = useState<OtInsumoRow[]>(ot.insumos);

  const inventarioOpts = useMemo(
    () =>
      inventario.map((i) => ({
        value: String(i.id),
        label: i.codigo
          ? `${i.codigo} — ${i.descripcion ?? ""}`
          : (i.descripcion ?? `#${i.id}`),
      })),
    [inventario],
  );

  const insumosDirty = useMemo(() => {
    if (insumosDraft.length !== ot.insumos.length) return true;
    for (let i = 0; i < insumosDraft.length; i++) {
      const a = insumosDraft[i];
      const b = ot.insumos[i];
      if (!b) return true;
      if (
        a.itemInventarioId !== b.itemInventarioId ||
        a.cantidad !== b.cantidad ||
        a.costoUnitario !== b.costoUnitario ||
        (a.unidadMedida ?? "") !== (b.unidadMedida ?? "")
      ) {
        return true;
      }
    }
    return false;
  }, [insumosDraft, ot.insumos]);

  const totalEstimado = insumosDraft.reduce(
    (acc, r) => acc + r.cantidad * r.costoUnitario,
    0,
  );

  const addInsumo = () => {
    setInsumosDraft((prev) => [
      ...prev,
      {
        itemInventarioId: 0,
        itemCodigo: "",
        itemDescripcion: "",
        cantidad: 0,
        unidadMedida: null,
        costoUnitario: 0,
        costoTotal: 0,
        stockDisponible: 0,
      },
    ]);
  };

  const removeInsumo = (index: number) => {
    setInsumosDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInsumo = (index: number, patch: Partial<OtInsumoRow>) => {
    setInsumosDraft((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const pickItem = (index: number, itemId: number) => {
    const item = inventario.find((i) => i.id === itemId);
    if (!item) return;
    updateInsumo(index, {
      itemInventarioId: item.id,
      itemCodigo: item.codigo,
      itemDescripcion: item.descripcion,
      unidadMedida: item.unidadMedida,
      costoUnitario: item.valorUnitario,
      stockDisponible: item.stock,
    });
  };

  const saveHeader = () => {
    setHeaderErrors({});
    startHeader(async () => {
      const res = await updateOT(ot.id, {
        titulo,
        descripcionTrabajo,
        localidadId,
        unidadProductivaId,
        solicitanteId,
        responsableId,
        prioridad,
        observaciones,
      });
      if (!res.ok) {
        if (res.error === "invalid" && res.fieldErrors) {
          setHeaderErrors(res.fieldErrors);
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
      toast.success(tO("avisos.actualizadaExitosa"));
      setEditOpen(false);
      router.refresh();
    });
  };

  const saveInsumos = () => {
    if (insumosDraft.some((r) => r.itemInventarioId <= 0)) {
      toast.error(tO("insumos.itemRequeridoToast"));
      return;
    }
    startInsumos(async () => {
      const payload = {
        insumos: insumosDraft.map((r) => ({
          id: r.id,
          itemInventarioId: r.itemInventarioId,
          cantidad: r.cantidad,
          unidadMedida: r.unidadMedida ?? "",
          costoUnitario: r.costoUnitario,
        })),
      };
      const res = await saveOtInsumos(ot.id, payload);
      if (!res.ok) {
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
      toast.success(tO("avisos.insumosGuardados"));
      router.refresh();
    });
  };

  const cerrar = () => {
    if (insumosDirty) {
      toast.error(tO("avisos.guardarInsumosAntes"));
      return;
    }
    startAction(async () => {
      const res = await cerrarOT(ot.id);
      if (!res.ok) {
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
      toast.success(tO("avisos.cerradaExitosa"));
      router.refresh();
    });
  };

  const cancelar = () => {
    startAction(async () => {
      const res = await cancelarOT(ot.id);
      if (!res.ok) {
        toast.error(tO("avisos.errorGenerico"));
        return;
      }
      toast.success(tO("avisos.canceladaExitosa"));
      router.refresh();
    });
  };

  const sobreconsumo = insumosDraft.some(
    (r) => r.itemInventarioId > 0 && r.cantidad > r.stockDisponible,
  );

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
          title={`${numero} · ${ot.titulo}`}
          description={tO("detalleDescripcion")}
          actions={
            <div className="flex items-center gap-2">
              {activa ? (
                <>
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">{tO("editar")}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{tO("editarTitulo")}</DialogTitle>
                        <DialogDescription>{tO("formAyuda")}</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>{tO("campos.titulo")} *</Label>
                          <Input
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            maxLength={200}
                          />
                          {headerErrors.titulo ? (
                            <span className="text-xs text-destructive">
                              {headerErrors.titulo}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>{tO("campos.descripcionTrabajo")}</Label>
                          <Textarea
                            value={descripcionTrabajo}
                            onChange={(e) =>
                              setDescripcionTrabajo(e.target.value)
                            }
                            rows={3}
                            maxLength={2000}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label>{tO("campos.solicitante")}</Label>
                            <Combobox
                              value={
                                solicitanteId ? String(solicitanteId) : ""
                              }
                              onChange={(v) =>
                                setSolicitanteId(v ? Number(v) : null)
                              }
                              options={[
                                { value: "", label: "—" },
                                ...usuarios.map((u) => ({
                                  value: String(u.id),
                                  label: u.nombre,
                                })),
                              ]}
                              placeholder={tO("campos.solicitante")}
                              allowCreate={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>{tO("campos.responsable")}</Label>
                            <Combobox
                              value={
                                responsableId ? String(responsableId) : ""
                              }
                              onChange={(v) =>
                                setResponsableId(v ? Number(v) : null)
                              }
                              options={[
                                { value: "", label: "—" },
                                ...usuarios.map((u) => ({
                                  value: String(u.id),
                                  label: u.nombre,
                                })),
                              ]}
                              placeholder={tO("campos.responsable")}
                              allowCreate={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>{tO("campos.localidad")}</Label>
                            <Combobox
                              value={localidadId ? String(localidadId) : ""}
                              onChange={(v) =>
                                setLocalidadId(v ? Number(v) : null)
                              }
                              options={[
                                { value: "", label: "—" },
                                ...localidades.map((l) => ({
                                  value: String(l.id),
                                  label: l.nombre,
                                })),
                              ]}
                              placeholder={tO("campos.localidad")}
                              allowCreate={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>{tO("campos.unidadProductiva")}</Label>
                            <Combobox
                              value={
                                unidadProductivaId
                                  ? String(unidadProductivaId)
                                  : ""
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
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>{tO("campos.prioridad")}</Label>
                            <Select
                              value={prioridad}
                              onValueChange={(v) =>
                                setPrioridad(v as OtPrioridad)
                              }
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
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>{tO("campos.observaciones")}</Label>
                          <Textarea
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            rows={2}
                            maxLength={2000}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditOpen(false)}
                          disabled={pendingHeader}
                        >
                          {tO("cancelar")}
                        </Button>
                        <Button onClick={saveHeader} disabled={pendingHeader}>
                          {tO("guardar")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <ConfirmDialog
                    title={tO("avisos.cancelarTitulo")}
                    description={tO("avisos.cancelarDescripcion")}
                    confirmLabel={tO("cancelarOt")}
                    cancelLabel={tO("cancelar")}
                    onConfirm={cancelar}
                    destructive
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction}
                      >
                        <XCircle className="size-4" />
                        {tO("cancelarOt")}
                      </Button>
                    }
                  />
                  <Button
                    onClick={cerrar}
                    disabled={pendingAction || insumosDirty}
                    title={insumosDirty ? tO("avisos.guardarInsumosAntes") : ""}
                  >
                    <CheckCircle2 className="size-4" />
                    {tO("cerrar")}
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="text-sm">
                  {ot.estado}
                </Badge>
              )}
            </div>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <span className="text-xs uppercase text-muted-foreground">
            {tO("campos.estado")}
          </span>
          <Badge
            variant={
              ot.estado === "En Curso"
                ? "default"
                : ot.estado === "Cerrada"
                  ? "secondary"
                  : "outline"
            }
            className="self-start text-xs"
          >
            {ot.estado}
          </Badge>
          <MetaRow
            label={tO("campos.fechaCreacion")}
            value={format(new Date(ot.fechaCreacion), "dd/MM/yyyy", {
              locale: es,
            })}
          />
          {ot.fechaFinalizacion ? (
            <MetaRow
              label={tO("campos.fechaFinalizacion")}
              value={format(new Date(ot.fechaFinalizacion), "dd/MM/yyyy", {
                locale: es,
              })}
            />
          ) : null}
          <MetaRow label={tO("campos.prioridad")} value={ot.prioridad} />
          {ot.creadoPor ? (
            <MetaRow label={tO("campos.creadoPor")} value={ot.creadoPor} />
          ) : null}
        </div>

        <div className="flex flex-col gap-2 rounded-md border p-4">
          <span className="text-xs uppercase text-muted-foreground">
            {tO("secciones.responsables")}
          </span>
          <MetaRow
            label={tO("campos.solicitante")}
            value={
              usuarios.find((u) => u.id === ot.solicitanteId)?.nombre ?? "—"
            }
          />
          <MetaRow
            label={tO("campos.responsable")}
            value={
              usuarios.find((u) => u.id === ot.responsableId)?.nombre ?? "—"
            }
          />
          <MetaRow
            label={tO("campos.localidad")}
            value={
              localidades.find((l) => l.id === ot.localidadId)?.nombre ?? "—"
            }
          />
          <MetaRow
            label={tO("campos.unidadProductiva")}
            value={
              unidadesProductivas.find((u) => u.id === ot.unidadProductivaId)
                ?.nombre ?? "—"
            }
          />
        </div>

        <div className="flex flex-col gap-2 rounded-md border p-4">
          <span className="text-xs uppercase text-muted-foreground">
            {tO("secciones.trabajo")}
          </span>
          <p className="text-sm whitespace-pre-wrap">
            {ot.descripcionTrabajo || (
              <span className="text-muted-foreground">
                {tO("avisos.sinDescripcion")}
              </span>
            )}
          </p>
          {ot.observaciones ? (
            <div className="mt-2 border-t pt-2">
              <span className="text-xs uppercase text-muted-foreground">
                {tO("campos.observaciones")}
              </span>
              <p className="text-sm whitespace-pre-wrap">{ot.observaciones}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{tO("insumos.titulo")}</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums text-muted-foreground">
              {tO("insumos.totalEstimado")}: {totalEstimado.toFixed(2)}
            </span>
            {!terminal ? (
              <Button variant="outline" size="sm" onClick={addInsumo}>
                <Plus className="size-4" />
                {tO("insumos.agregar")}
              </Button>
            ) : null}
          </div>
        </div>

        {insumosDraft.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tO("insumos.vacio")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">
                    {tO("insumos.item")}
                  </th>
                  <th className="py-2 text-left font-medium">
                    {tO("insumos.cantidad")}
                  </th>
                  <th className="py-2 text-left font-medium">
                    {tO("insumos.unidadMedida")}
                  </th>
                  <th className="py-2 text-left font-medium">
                    {tO("insumos.costoUnitario")}
                  </th>
                  <th className="py-2 text-left font-medium">
                    {tO("insumos.costoTotal")}
                  </th>
                  {!terminal ? (
                    <th className="py-2 text-left font-medium"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {insumosDraft.map((row, index) => {
                  const rowTotal = row.cantidad * row.costoUnitario;
                  const over =
                    row.itemInventarioId > 0 &&
                    row.cantidad > row.stockDisponible;
                  return (
                    <tr key={index} className="border-b align-top">
                      <td className="py-2 pr-2">
                        {terminal ? (
                          <span className="text-sm">
                            {row.itemCodigo
                              ? `${row.itemCodigo} — ${row.itemDescripcion ?? ""}`
                              : (row.itemDescripcion ?? `#${row.itemInventarioId}`)}
                          </span>
                        ) : (
                          <>
                            <Combobox
                              value={
                                row.itemInventarioId
                                  ? String(row.itemInventarioId)
                                  : ""
                              }
                              onChange={(v) =>
                                v ? pickItem(index, Number(v)) : null
                              }
                              options={inventarioOpts}
                              placeholder={tO("insumos.item")}
                              allowCreate={false}
                            />
                            {row.itemInventarioId <= 0 ? (
                              <span className="mt-1 block text-xs text-destructive">
                                {tO("insumos.itemRequerido")}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={row.cantidad}
                          onChange={(e) =>
                            updateInsumo(index, {
                              cantidad: Number(e.target.value) || 0,
                            })
                          }
                          disabled={terminal}
                          className="w-24"
                        />
                        {over ? (
                          <span className="text-xs text-destructive">
                            {tO("insumos.sobreConsumoAviso")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="text-xs text-muted-foreground">
                          {row.unidadMedida ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={row.costoUnitario}
                          onChange={(e) =>
                            updateInsumo(index, {
                              costoUnitario: Number(e.target.value) || 0,
                            })
                          }
                          disabled={terminal}
                          className="w-28"
                        />
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        {rowTotal.toFixed(2)}
                      </td>
                      {!terminal ? (
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInsumo(index)}
                            aria-label={tO("insumos.eliminar")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!terminal ? (
          <div className="flex items-center justify-end gap-2">
            {sobreconsumo ? (
              <span className="text-xs text-destructive">
                {tO("insumos.sobreConsumoAvisoFooter")}
              </span>
            ) : null}
            <Button
              onClick={saveInsumos}
              disabled={pendingInsumos || !insumosDirty}
            >
              {tO("insumos.guardar")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
