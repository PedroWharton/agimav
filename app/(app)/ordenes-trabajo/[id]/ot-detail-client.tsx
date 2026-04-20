"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Combobox } from "@/components/app/combobox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  FilesGrid,
  KVGrid,
  OTHero,
  OtStatusMeter,
  PartesTable,
  type KVPair,
} from "@/components/mantenimiento/detail";
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

type HeroPrioridad = "baja" | "media" | "alta";
function heroPrioridad(p: string): HeroPrioridad {
  const k = p.toLowerCase();
  if (k === "alta") return "alta";
  if (k === "baja") return "baja";
  return "media";
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type OtTransition = "cerrar" | "cancelar";

function otAllowedTransitions(estado: string): OtTransition[] {
  if (estado === "En Curso") return ["cerrar", "cancelar"];
  return [];
}

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
  const transitions = otAllowedTransitions(ot.estado);

  // ─── Edit header dialog ──────────────────────────────────────────────
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

  // ─── Insumos draft ───────────────────────────────────────────────────
  const [insumosDraft, setInsumosDraft] = useState<OtInsumoRow[]>(ot.insumos);
  const [estadoMenuOpen, setEstadoMenuOpen] = useState(false);

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

  const usuarioOptions = useMemo(
    () =>
      usuarios.map((u) => ({ value: String(u.id), label: u.nombre })),
    [usuarios],
  );

  const localidadOptions = useMemo(
    () =>
      localidades.map((l) => ({ value: String(l.id), label: l.nombre })),
    [localidades],
  );

  const upOptions = useMemo(
    () =>
      unidadesProductivas.map((u) => ({
        value: String(u.id),
        label: u.localidad ? `${u.nombre} (${u.localidad})` : u.nombre,
      })),
    [unidadesProductivas],
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

  const totalEstimado = useMemo(
    () =>
      insumosDraft.reduce((acc, r) => acc + r.cantidad * r.costoUnitario, 0),
    [insumosDraft],
  );

  const sobreconsumo = insumosDraft.some(
    (r) => r.itemInventarioId > 0 && r.cantidad > r.stockDisponible,
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

  const handleTransition = (t: OtTransition) => {
    setEstadoMenuOpen(false);
    if (t === "cerrar") cerrar();
    else if (t === "cancelar") cancelar();
  };

  const busy = pendingHeader || pendingInsumos || pendingAction;

  const subtitle = `${tO("campos.fechaCreacion")}: ${format(
    new Date(ot.fechaCreacion),
    "dd/MM/yyyy",
    { locale: es },
  )}${ot.creadoPor ? ` · ${ot.creadoPor}` : ""}`;

  const kvItems: KVPair[] = [
    {
      label: tO("campos.prioridad"),
      value: ot.prioridad,
    },
    {
      label: tO("campos.solicitante"),
      value: usuarios.find((u) => u.id === ot.solicitanteId)?.nombre ?? null,
    },
    {
      label: tO("campos.responsable"),
      value: usuarios.find((u) => u.id === ot.responsableId)?.nombre ?? null,
    },
    {
      label: tO("campos.localidad"),
      value: localidades.find((l) => l.id === ot.localidadId)?.nombre ?? null,
    },
    {
      label: tO("campos.unidadProductiva"),
      value: (() => {
        const up = unidadesProductivas.find(
          (u) => u.id === ot.unidadProductivaId,
        );
        if (!up) return null;
        return up.localidad ? `${up.nombre} (${up.localidad})` : up.nombre;
      })(),
    },
    {
      label: tO("campos.fechaCreacion"),
      value: format(new Date(ot.fechaCreacion), "dd/MM/yyyy", { locale: es }),
    },
    {
      label: tO("campos.fechaFinalizacion"),
      value: ot.fechaFinalizacion
        ? format(new Date(ot.fechaFinalizacion), "dd/MM/yyyy", { locale: es })
        : null,
    },
    {
      label: tO("campos.creadoPor"),
      value: ot.creadoPor ?? null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/ordenes-trabajo">
            <ArrowLeft className="size-4" />
            {tO("volver")}
          </Link>
        </Button>

        <div className="relative">
          <OTHero
            id={numero}
            tipo={{ label: tO("titulo"), tone: "info" }}
            prioridad={heroPrioridad(ot.prioridad)}
            estado={{
              label: ot.estado,
              onChangeRequest:
                !terminal && transitions.length > 0
                  ? () => setEstadoMenuOpen(true)
                  : undefined,
            }}
            title={ot.titulo}
            subtitle={subtitle}
            actions={
              !terminal ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  disabled={busy}
                >
                  <Pencil className="size-4" />
                  {tO("editar")}
                </Button>
              ) : null
            }
          />

          {/* Invisible anchor so the controlled DropdownMenu opens next to the
              estado pill (mirrors the mantenimiento detail layout). */}
          <DropdownMenu open={estadoMenuOpen} onOpenChange={setEstadoMenuOpen}>
            <DropdownMenuTrigger
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none absolute right-5 top-12 size-0 opacity-0"
            >
              <span className="sr-only">{tO("campos.estado")}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel>{tO("campos.estado")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {transitions.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => handleTransition(t)}
                  disabled={busy || (t === "cerrar" && insumosDirty)}
                >
                  {t === "cerrar" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  {t === "cerrar" ? tO("cerrar") : tO("cancelarOt")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <OtStatusMeter estado={ot.estado} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="flex flex-col gap-5">
          {/* Datos generales */}
          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">
              {tO("secciones.responsables")}
            </h2>
            <KVGrid items={kvItems} columns={4} />
          </Card>

          {/* Descripción del trabajo */}
          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">
              {tO("campos.descripcionTrabajo")}
            </h2>
            {ot.descripcionTrabajo ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {ot.descripcionTrabajo}
              </p>
            ) : (
              <p className="text-sm text-subtle-foreground">
                {tO("avisos.sinDescripcion")}
              </p>
            )}
            {ot.observaciones ? (
              <div className="mt-2 border-t border-border pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                  {tO("campos.observaciones")}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {ot.observaciones}
                </p>
              </div>
            ) : null}
          </Card>

          {/* Insumos editor */}
          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                {tO("insumos.titulo")}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-subtle-foreground">
                  {tO("insumos.totalEstimado")}:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {formatARS(totalEstimado)}
                  </span>
                </span>
                {!terminal ? (
                  <>
                    <Button variant="outline" size="sm" onClick={addInsumo}>
                      <Plus className="size-4" />
                      {tO("insumos.agregar")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveInsumos}
                      disabled={pendingInsumos || !insumosDirty}
                    >
                      {tO("insumos.guardar")}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {insumosDraft.length === 0 ? (
              <p className="text-sm text-subtle-foreground">
                {tO("insumos.vacio")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      <th className="py-2 pr-2">{tO("insumos.item")}</th>
                      <th className="py-2 pr-2">{tO("insumos.cantidad")}</th>
                      <th className="py-2 pr-2">
                        {tO("insumos.unidadMedida")}
                      </th>
                      <th className="py-2 pr-2">
                        {tO("insumos.costoUnitario")}
                      </th>
                      <th className="py-2 pr-2">
                        {tO("insumos.costoTotal")}
                      </th>
                      {!terminal ? <th className="py-2"></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {insumosDraft.map((row, index) => {
                      const rowTotal = row.cantidad * row.costoUnitario;
                      const over =
                        row.itemInventarioId > 0 &&
                        row.cantidad > row.stockDisponible;
                      return (
                        <tr
                          key={index}
                          className="border-b border-dashed border-border align-top last:border-b-0"
                        >
                          <td className="py-2 pr-2">
                            {terminal ? (
                              <span className="text-sm">
                                {row.itemCodigo
                                  ? `${row.itemCodigo} — ${row.itemDescripcion ?? ""}`
                                  : (row.itemDescripcion ??
                                    `#${row.itemInventarioId}`)}
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
                            <span className="text-xs text-subtle-foreground">
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
                          <td className="py-2 pr-2 font-mono tabular-nums">
                            {formatARS(rowTotal)}
                          </td>
                          {!terminal ? (
                            <td className="py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeInsumo(index)}
                                aria-label={tO("insumos.eliminar")}
                                className="size-7 text-muted-foreground hover:text-destructive"
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

            {sobreconsumo && !terminal ? (
              <p className="text-xs text-destructive">
                {tO("insumos.sobreConsumoAvisoFooter")}
              </p>
            ) : null}
          </Card>

          {/* Partes de trabajo — empty (not wired for OT in v1) */}
          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">Partes de trabajo</h2>
            <PartesTable rows={[]} />
          </Card>

          {/* Archivos adjuntos — empty in v1 */}
          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">Archivos adjuntos</h2>
            <FilesGrid files={[]} />
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {!terminal && transitions.length > 0 ? (
            <Card className="gap-2 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                {tO("campos.estado")}
              </h3>
              <div className="flex flex-col gap-2">
                {activa ? (
                  <Button
                    size="sm"
                    onClick={cerrar}
                    disabled={busy || insumosDirty}
                    title={
                      insumosDirty ? tO("avisos.guardarInsumosAntes") : ""
                    }
                    className="justify-start"
                  >
                    <CheckCircle2 className="size-4" />
                    {tO("cerrar")}
                  </Button>
                ) : null}
                {activa ? (
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
                        disabled={busy}
                        className="justify-start"
                      >
                        <XCircle className="size-4" />
                        {tO("cancelarOt")}
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Costos */}
          <Card className="gap-2 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
              {tO("insumos.totalEstimado")}
            </h3>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-subtle-foreground">
                {tO("insumos.titulo")}
              </span>
              <span className="font-mono font-medium">
                {formatARS(totalEstimado)}
              </span>
            </div>
          </Card>
        </aside>
      </div>

      {/* ─── Edit header dialog ────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
                onChange={(e) => setDescripcionTrabajo(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.solicitante")}</Label>
                <Combobox
                  value={solicitanteId ? String(solicitanteId) : ""}
                  onChange={(v) => setSolicitanteId(v ? Number(v) : null)}
                  options={[{ value: "", label: "—" }, ...usuarioOptions]}
                  placeholder={tO("campos.solicitante")}
                  allowCreate={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.responsable")}</Label>
                <Combobox
                  value={responsableId ? String(responsableId) : ""}
                  onChange={(v) => setResponsableId(v ? Number(v) : null)}
                  options={[{ value: "", label: "—" }, ...usuarioOptions]}
                  placeholder={tO("campos.responsable")}
                  allowCreate={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{tO("campos.localidad")}</Label>
                <Combobox
                  value={localidadId ? String(localidadId) : ""}
                  onChange={(v) => setLocalidadId(v ? Number(v) : null)}
                  options={[{ value: "", label: "—" }, ...localidadOptions]}
                  placeholder={tO("campos.localidad")}
                  allowCreate={false}
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
                  options={[{ value: "", label: "—" }, ...upOptions]}
                  placeholder={tO("campos.unidadProductiva")}
                  allowCreate={false}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>{tO("campos.prioridad")}</Label>
                <Select
                  value={prioridad}
                  onValueChange={(v) => setPrioridad(v as OtPrioridad)}
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
    </div>
  );
}
