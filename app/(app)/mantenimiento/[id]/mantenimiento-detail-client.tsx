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
  Play,
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MantEstadoChip } from "@/components/mantenimiento/estado-chip";
import { HistorialTimeline } from "@/components/mantenimiento/historial-timeline";
import {
  InsumosEditor,
  type InsumoLine,
  type InventarioOption,
} from "@/components/mantenimiento/insumos-editor";
import {
  MANT_PRIORIDADES,
  allowedTransitions,
  isTerminal,
} from "@/lib/mantenimiento/estado";

import {
  addObservacion,
  saveInsumos,
  saveTareas,
  transitionEstado,
  updateMantenimientoHeader,
} from "../actions";

type UsuarioOpt = { id: number; nombre: string };
type UpOpt = { id: number; nombre: string; localidad: string | null };

export type MantenimientoDetailData = {
  id: number;
  tipo: string;
  estado: string;
  prioridad: string;
  descripcion: string | null;
  fechaCreacion: string;
  fechaInicio: string | null;
  fechaFinalizacion: string | null;
  fechaProgramada: string | null;
  creadoPor: string | null;
  programarRevision: boolean;
  fechaProximaRevision: string | null;
  descripcionRevision: string | null;
  maquinaria: { id: number; label: string };
  responsable: { id: number; nombre: string };
  unidadProductiva: {
    id: number;
    nombre: string;
    localidad: string | null;
  } | null;
  tallerAsignado: {
    id: number;
    nombre: string;
    localidad: string | null;
  } | null;
  insumos: Array<{
    id: number;
    itemInventarioId: number;
    cantidadSugerida: number;
    cantidadUtilizada: number;
    unidadMedida: string;
    costoUnitario: number;
  }>;
  tareas: Array<{
    id: number;
    descripcion: string;
    realizada: boolean;
  }>;
  historial: Array<{
    id: number;
    tipoCambio: string;
    valorAnterior: string | null;
    valorNuevo: string | null;
    detalle: string | null;
    fechaCambio: string;
    usuario: string;
  }>;
};

type TareaDraft = {
  id?: number;
  descripcion: string;
  realizada: boolean;
};

export function MantenimientoDetailClient({
  data,
  isAdmin,
  usuarios,
  unidadesProductivas,
  inventario,
}: {
  data: MantenimientoDetailData;
  isAdmin: boolean;
  usuarios: UsuarioOpt[];
  unidadesProductivas: UpOpt[];
  inventario: InventarioOption[];
}) {
  const tM = useTranslations("mantenimiento");
  const tTipos = useTranslations("mantenimiento.tipos");
  const router = useRouter();

  const terminal = isTerminal(data.estado);
  const transitions = allowedTransitions(data.estado, { isAdmin });

  // ─── Insumos draft ───────────────────────────────────────────────────
  const [insumos, setInsumos] = useState<InsumoLine[]>(
    data.insumos.map((i) => ({
      id: i.id,
      itemInventarioId: i.itemInventarioId,
      cantidadSugerida: i.cantidadSugerida,
      cantidadUtilizada: i.cantidadUtilizada,
      unidadMedida: i.unidadMedida,
      costoUnitario: i.costoUnitario,
    })),
  );
  const [savingInsumos, startSaveInsumos] = useTransition();

  // ─── Tareas draft ────────────────────────────────────────────────────
  const [tareas, setTareas] = useState<TareaDraft[]>(
    data.tareas.map((t) => ({
      id: t.id,
      descripcion: t.descripcion,
      realizada: t.realizada,
    })),
  );
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [savingTareas, startSaveTareas] = useTransition();

  // ─── Observación nueva ───────────────────────────────────────────────
  const [observacionTexto, setObservacionTexto] = useState("");
  const [savingObservacion, startSaveObservacion] = useTransition();

  // ─── Edit header dialog ──────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    descripcion: data.descripcion ?? "",
    responsableId: data.responsable.id,
    unidadProductivaId: data.unidadProductiva?.id ?? null,
    tallerAsignadoId: data.tallerAsignado?.id ?? null,
    fechaProgramada: data.fechaProgramada
      ? data.fechaProgramada.slice(0, 10)
      : "",
    prioridad: data.prioridad,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingHeader, startSaveHeader] = useTransition();

  // ─── Transition state ────────────────────────────────────────────────
  const [transitioning, startTransition] = useTransition();
  const [tallerDialog, setTallerDialog] = useState<{
    mode: "iniciar" | "cambiar";
    tallerAsignadoId: number | null;
  } | null>(null);
  const [finalizarDialog, setFinalizarDialog] = useState<{
    programarRevision: boolean;
    fechaProximaRevision: string;
    descripcionRevision: string;
  } | null>(null);

  const upOptions = useMemo(
    () =>
      unidadesProductivas.map((u) => ({
        value: String(u.id),
        label: u.localidad ? `${u.nombre} (${u.localidad})` : u.nombre,
      })),
    [unidadesProductivas],
  );

  const usuarioOptions = useMemo(
    () =>
      usuarios.map((u) => ({ value: String(u.id), label: u.nombre })),
    [usuarios],
  );

  // ─── Actions ─────────────────────────────────────────────────────────
  const handleSaveHeader = () => {
    setEditErrors({});
    startSaveHeader(async () => {
      const res = await updateMantenimientoHeader(data.id, {
        descripcion: editForm.descripcion,
        responsableId: editForm.responsableId,
        unidadProductivaId: editForm.unidadProductivaId,
        tallerAsignadoId: editForm.tallerAsignadoId,
        fechaProgramada: editForm.fechaProgramada,
        prioridad: editForm.prioridad,
        programarRevision: false,
        fechaProximaRevision: "",
        descripcionRevision: "",
      });
      if (!res.ok) {
        if (res.error === "invalid" && res.fieldErrors) {
          setEditErrors(res.fieldErrors);
        } else if (res.error === "wrong_estado") {
          toast.error(tM("avisos.estadoTerminal"));
        } else {
          toast.error(tM("avisos.errorGenerico"));
        }
        return;
      }
      toast.success(tM("avisos.guardadoExitoso"));
      setEditOpen(false);
      router.refresh();
    });
  };

  const handleSaveInsumos = () => {
    const lines = insumos
      .filter((l) => l.itemInventarioId != null)
      .map((l) => ({
        id: l.id,
        itemInventarioId: l.itemInventarioId as number,
        cantidadSugerida: l.cantidadSugerida,
        cantidadUtilizada: l.cantidadUtilizada,
        unidadMedida: l.unidadMedida,
        costoUnitario: l.costoUnitario,
      }));
    startSaveInsumos(async () => {
      const res = await saveInsumos(data.id, { lines });
      if (!res.ok) {
        toast.error(tM("avisos.errorGenerico"));
        return;
      }
      toast.success(tM("avisos.insumosGuardados"));
      router.refresh();
    });
  };

  const handleSaveTareas = () => {
    startSaveTareas(async () => {
      const res = await saveTareas(data.id, { lines: tareas });
      if (!res.ok) {
        toast.error(tM("avisos.errorGenerico"));
        return;
      }
      toast.success(tM("avisos.tareasGuardadas"));
      router.refresh();
    });
  };

  const handleAddTarea = () => {
    const desc = nuevaTarea.trim();
    if (!desc) return;
    setTareas((prev) => [...prev, { descripcion: desc, realizada: false }]);
    setNuevaTarea("");
  };

  const handleAddObservacion = () => {
    const texto = observacionTexto.trim();
    if (!texto) return;
    startSaveObservacion(async () => {
      const res = await addObservacion(data.id, { texto });
      if (!res.ok) {
        toast.error(tM("avisos.errorGenerico"));
        return;
      }
      setObservacionTexto("");
      router.refresh();
    });
  };

  const runTransition = (
    target: string,
    extra: {
      tallerAsignadoId?: number | null;
      programarRevision?: boolean;
      fechaProximaRevision?: string;
      descripcionRevision?: string;
    } = {},
  ) => {
    startTransition(async () => {
      const res = await transitionEstado(data.id, {
        target,
        tallerAsignadoId: extra.tallerAsignadoId ?? null,
        programarRevision: extra.programarRevision ?? false,
        fechaProximaRevision: extra.fechaProximaRevision ?? "",
        descripcionRevision: extra.descripcionRevision ?? "",
      });
      if (!res.ok) {
        if (res.error === "wrong_estado") {
          toast.error(tM("avisos.cambioEstadoConflicto"));
          router.refresh();
        } else if (res.error === "forbidden") {
          toast.error(tM("avisos.sinPermisos"));
        } else {
          toast.error(tM("avisos.errorGenerico"));
        }
        return;
      }
      toast.success(tM("avisos.transicionExitosa"));
      setTallerDialog(null);
      setFinalizarDialog(null);
      router.refresh();
    });
  };

  const openTallerDialog = (mode: "iniciar" | "cambiar") => {
    setTallerDialog({
      mode,
      tallerAsignadoId: data.tallerAsignado?.id ?? null,
    });
  };

  const submitTallerDialog = () => {
    if (!tallerDialog?.tallerAsignadoId) return;
    runTransition("En Reparación - Taller", {
      tallerAsignadoId: tallerDialog.tallerAsignadoId,
    });
  };

  const submitFinalizarDialog = () => {
    if (!finalizarDialog) return;
    runTransition("Finalizado", {
      programarRevision: finalizarDialog.programarRevision,
      fechaProximaRevision: finalizarDialog.fechaProximaRevision,
      descripcionRevision: finalizarDialog.descripcionRevision,
    });
  };

  const busy =
    transitioning || savingInsumos || savingTareas || savingHeader;

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
          title={`#${data.id} · ${data.maquinaria.label}`}
          description={`${tTipos(data.tipo as "correctivo" | "preventivo")} · ${tM("campos.creado")} ${format(new Date(data.fechaCreacion), "dd/MM/yyyy", { locale: es })}${data.creadoPor ? ` · ${data.creadoPor}` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MantEstadoChip estado={data.estado} />
              {!terminal ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  disabled={busy}
                >
                  <Pencil className="size-4" />
                  {tM("acciones.editar")}
                </Button>
              ) : null}
              {transitions.includes("iniciarChacra") ? (
                <Button
                  size="sm"
                  onClick={() => runTransition("En Reparación - Chacra")}
                  disabled={busy}
                >
                  <Play className="size-4" />
                  {tM("acciones.iniciarChacra")}
                </Button>
              ) : null}
              {transitions.includes("iniciarTaller") ? (
                <Button
                  size="sm"
                  onClick={() => openTallerDialog("iniciar")}
                  disabled={busy}
                >
                  <Wrench className="size-4" />
                  {tM("acciones.iniciarTaller")}
                </Button>
              ) : null}
              {transitions.includes("cambiarTaller") ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openTallerDialog("cambiar")}
                  disabled={busy}
                >
                  <Wrench className="size-4" />
                  {tM("acciones.cambiarTaller")}
                </Button>
              ) : null}
              {transitions.includes("finalizar") ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setFinalizarDialog({
                      programarRevision: false,
                      fechaProximaRevision: "",
                      descripcionRevision: "",
                    })
                  }
                  disabled={busy}
                >
                  <CheckCircle2 className="size-4" />
                  {tM("acciones.finalizar")}
                </Button>
              ) : null}
              {transitions.includes("cancelar") ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={busy}>
                      <X className="size-4" />
                      {tM("acciones.cancelar")}
                    </Button>
                  }
                  title={tM("avisos.cancelarTitulo")}
                  description={tM("avisos.cancelarDescripcion")}
                  confirmLabel={tM("acciones.cancelar")}
                  destructive
                  onConfirm={() => runTransition("Cancelado")}
                />
              ) : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {/* Descripción */}
          <section className="rounded-md border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">
              {tM("campos.descripcion")}
            </h2>
            {data.descripcion ? (
              <p className="whitespace-pre-wrap text-sm">{data.descripcion}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tM("avisos.sinDescripcion")}
              </p>
            )}
          </section>

          {/* Tareas */}
          <section className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tM("tareas.titulo")}</h2>
              {!terminal ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveTareas}
                  disabled={busy}
                >
                  {tM("tareas.guardar")}
                </Button>
              ) : null}
            </div>
            {tareas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tM("tareas.sinTareas")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {tareas.map((t, idx) => (
                  <li
                    key={t.id ?? `new-${idx}`}
                    className="flex items-start gap-2"
                  >
                    <Checkbox
                      id={`tarea-${idx}`}
                      checked={t.realizada}
                      onCheckedChange={(v) => {
                        const next = [...tareas];
                        next[idx] = { ...next[idx], realizada: v === true };
                        setTareas(next);
                      }}
                      disabled={terminal}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`tarea-${idx}`}
                      className="flex-1 text-sm font-normal"
                    >
                      <span className={t.realizada ? "line-through text-muted-foreground" : ""}>
                        {t.descripcion}
                      </span>
                    </Label>
                    {!terminal ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setTareas((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="size-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {!terminal ? (
              <div className="mt-3 flex gap-2">
                <Input
                  value={nuevaTarea}
                  onChange={(e) => setNuevaTarea(e.target.value)}
                  placeholder={tM("tareas.placeholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTarea();
                    }
                  }}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTarea}
                  disabled={!nuevaTarea.trim()}
                >
                  <Plus className="size-4" />
                  {tM("tareas.agregar")}
                </Button>
              </div>
            ) : null}
          </section>

          {/* Insumos */}
          <section className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tM("insumos.titulo")}</h2>
              {!terminal ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveInsumos}
                  disabled={busy}
                >
                  {tM("insumos.guardar")}
                </Button>
              ) : null}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {tM("insumos.descripcionAyuda")}
            </p>
            <InsumosEditor
              lines={insumos}
              onChange={setInsumos}
              inventario={inventario}
              disabled={terminal}
            />
          </section>

          {/* Observaciones */}
          <section className="rounded-md border border-border p-4">
            <h2 className="mb-3 text-sm font-semibold">
              {tM("observaciones.titulo")}
            </h2>
            <div className="flex flex-col gap-2">
              <Textarea
                value={observacionTexto}
                onChange={(e) => setObservacionTexto(e.target.value)}
                placeholder={tM("observaciones.placeholder")}
                rows={2}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddObservacion}
                  disabled={!observacionTexto.trim() || savingObservacion}
                >
                  {tM("observaciones.agregar")}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border border-border p-4 text-sm">
            <dl className="grid grid-cols-1 gap-3">
              <MetaRow label={tM("campos.maquina")}>
                <Link
                  href={`/maquinaria`}
                  className="text-sm hover:underline"
                >
                  {data.maquinaria.label}
                </Link>
              </MetaRow>
              <MetaRow label={tM("campos.responsable")}>
                {data.responsable.nombre}
              </MetaRow>
              <MetaRow label={tM("campos.unidadProductiva")}>
                {data.unidadProductiva
                  ? data.unidadProductiva.localidad
                    ? `${data.unidadProductiva.nombre} (${data.unidadProductiva.localidad})`
                    : data.unidadProductiva.nombre
                  : "—"}
              </MetaRow>
              <MetaRow label={tM("campos.tallerAsignado")}>
                {data.tallerAsignado
                  ? data.tallerAsignado.localidad
                    ? `${data.tallerAsignado.nombre} (${data.tallerAsignado.localidad})`
                    : data.tallerAsignado.nombre
                  : "—"}
              </MetaRow>
              <MetaRow label={tM("campos.prioridad")}>
                {data.prioridad}
              </MetaRow>
            </dl>
          </div>

          <div className="rounded-md border border-border p-4 text-sm">
            <dl className="grid grid-cols-1 gap-3">
              <MetaRow label={tM("campos.fechaCreacion")}>
                {format(new Date(data.fechaCreacion), "dd/MM/yyyy HH:mm", {
                  locale: es,
                })}
              </MetaRow>
              {data.fechaProgramada ? (
                <MetaRow label={tM("campos.fechaProgramada")}>
                  {format(new Date(data.fechaProgramada), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </MetaRow>
              ) : null}
              {data.fechaInicio ? (
                <MetaRow label={tM("campos.fechaInicio")}>
                  {format(new Date(data.fechaInicio), "dd/MM/yyyy HH:mm", {
                    locale: es,
                  })}
                </MetaRow>
              ) : null}
              {data.fechaFinalizacion ? (
                <MetaRow label={tM("campos.fechaFinalizacion")}>
                  {format(
                    new Date(data.fechaFinalizacion),
                    "dd/MM/yyyy HH:mm",
                    { locale: es },
                  )}
                </MetaRow>
              ) : null}
            </dl>
          </div>

          {data.programarRevision && data.fechaProximaRevision ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                {tM("revision.titulo")}
              </div>
              <div className="mt-1 text-sm">
                {format(new Date(data.fechaProximaRevision), "dd/MM/yyyy", {
                  locale: es,
                })}
              </div>
              {data.descripcionRevision ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.descripcionRevision}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-md border border-border p-4 text-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tM("historial.titulo")}
            </h3>
            <HistorialTimeline rows={data.historial} />
          </div>
        </aside>
      </div>

      {/* ─── Edit header dialog ────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tM("acciones.editar")}</DialogTitle>
            <DialogDescription>
              {tM("avisos.editarDescripcion")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.descripcion")}</Label>
              <Textarea
                value={editForm.descripcion}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, descripcion: e.target.value }))
                }
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.responsable")} *</Label>
              <Combobox
                value={String(editForm.responsableId)}
                onChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    responsableId: v ? Number(v) : f.responsableId,
                  }))
                }
                options={usuarioOptions}
                placeholder={tM("campos.responsable")}
                allowCreate={false}
              />
              {editErrors.responsableId ? (
                <span className="text-xs text-destructive">
                  {editErrors.responsableId}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.unidadProductiva")}</Label>
              <Combobox
                value={
                  editForm.unidadProductivaId
                    ? String(editForm.unidadProductivaId)
                    : ""
                }
                onChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    unidadProductivaId: v ? Number(v) : null,
                  }))
                }
                options={[{ value: "", label: "—" }, ...upOptions]}
                placeholder={tM("campos.unidadProductiva")}
                allowCreate={false}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.tallerAsignado")}</Label>
              <Combobox
                value={
                  editForm.tallerAsignadoId
                    ? String(editForm.tallerAsignadoId)
                    : ""
                }
                onChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    tallerAsignadoId: v ? Number(v) : null,
                  }))
                }
                options={[{ value: "", label: "—" }, ...upOptions]}
                placeholder={tM("campos.tallerAsignado")}
                allowCreate={false}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.fechaProgramada")}</Label>
              <Input
                type="date"
                value={editForm.fechaProgramada}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    fechaProgramada: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tM("campos.prioridad")}</Label>
              <Select
                value={editForm.prioridad}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, prioridad: v }))
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingHeader}
            >
              {tM("acciones.cancelarDialogo")}
            </Button>
            <Button onClick={handleSaveHeader} disabled={savingHeader}>
              {tM("acciones.guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Taller dialog (iniciar/cambiar) ────────────────────────── */}
      <Dialog
        open={tallerDialog !== null}
        onOpenChange={(o) => {
          if (!o) setTallerDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tallerDialog?.mode === "cambiar"
                ? tM("acciones.cambiarTaller")
                : tM("acciones.iniciarTaller")}
            </DialogTitle>
            <DialogDescription>
              {tM("avisos.elegiTaller")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>{tM("campos.tallerAsignado")} *</Label>
            <Combobox
              value={
                tallerDialog?.tallerAsignadoId
                  ? String(tallerDialog.tallerAsignadoId)
                  : ""
              }
              onChange={(v) =>
                setTallerDialog((td) =>
                  td ? { ...td, tallerAsignadoId: v ? Number(v) : null } : td,
                )
              }
              options={upOptions}
              placeholder={tM("campos.tallerAsignado")}
              allowCreate={false}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTallerDialog(null)}
              disabled={transitioning}
            >
              {tM("acciones.cancelarDialogo")}
            </Button>
            <Button
              onClick={submitTallerDialog}
              disabled={transitioning || !tallerDialog?.tallerAsignadoId}
            >
              {tM("acciones.confirmar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Finalizar dialog ───────────────────────────────────────── */}
      <Dialog
        open={finalizarDialog !== null}
        onOpenChange={(o) => {
          if (!o) setFinalizarDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tM("acciones.finalizar")}</DialogTitle>
            <DialogDescription>
              {tM("avisos.finalizarDescripcion")}
            </DialogDescription>
          </DialogHeader>
          {finalizarDialog ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="programar-revision"
                  checked={finalizarDialog.programarRevision}
                  onCheckedChange={(v) =>
                    setFinalizarDialog((d) =>
                      d ? { ...d, programarRevision: v === true } : d,
                    )
                  }
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="programar-revision" className="font-normal">
                    {tM("revision.programar")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {tM("revision.ayuda")}
                  </span>
                </div>
              </div>
              {finalizarDialog.programarRevision ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>{tM("revision.fecha")}</Label>
                    <Input
                      type="date"
                      value={finalizarDialog.fechaProximaRevision}
                      onChange={(e) =>
                        setFinalizarDialog((d) =>
                          d
                            ? { ...d, fechaProximaRevision: e.target.value }
                            : d,
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{tM("revision.descripcion")}</Label>
                    <Textarea
                      value={finalizarDialog.descripcionRevision}
                      onChange={(e) =>
                        setFinalizarDialog((d) =>
                          d
                            ? { ...d, descripcionRevision: e.target.value }
                            : d,
                        )
                      }
                      rows={2}
                      maxLength={500}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinalizarDialog(null)}
              disabled={transitioning}
            >
              {tM("acciones.cancelarDialogo")}
            </Button>
            <Button
              onClick={submitFinalizarDialog}
              disabled={
                transitioning ||
                (finalizarDialog?.programarRevision === true &&
                  !finalizarDialog.fechaProximaRevision)
              }
            >
              {tM("acciones.confirmar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
