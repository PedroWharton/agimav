"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { cn } from "@/lib/utils";
import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { QtyStepper } from "@/components/compras/recepcion/qty-stepper";
import { EstadoChip } from "@/components/compras/estado-chip";
import {
  DetalleLinesEditor,
  type DetalleLine,
  type InventarioOption,
  emptyLine,
} from "@/components/compras/detalle-lines-editor";

import {
  createSolicitud,
  updateSolicitud,
  deleteSolicitud,
  submitSolicitud,
  approveSolicitud,
  rejectSolicitud,
} from "./actions";

const formSchema = z.object({
  solicitante: z.string().trim().min(1, "Obligatorio").max(120),
  unidadProductiva: z.string().trim().min(1, "Obligatorio").max(120),
  localidad: z.string().trim().min(1, "Obligatorio").max(120),
  prioridad: z.enum(["Normal", "Urgente"]),
  fechaTentativa: z.string().optional(),
  fechaLimite: z.string().optional(),
  notas: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export type SolicitudDetail = {
  id: number;
  fechaCreacion: string;
  solicitante: string;
  unidadProductiva: string;
  localidad: string;
  prioridad: string;
  estado: string;
  fechaTentativa: string | null;
  fechaLimite: string | null;
  notas: string | null;
  creadoPor: string | null;
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
  fechaCancelacion: string | null;
  canceladoPor: string | null;
  motivoRechazo: string | null;
  detalle: DetalleLine[];
  ocsVinculadas: Array<{
    id: number;
    numeroOc: string | null;
    proveedor: string;
    estado: string;
  }>;
};

export type SolicitudFormProps = {
  mode: "create" | "edit";
  initial: SolicitudDetail | null;
  inventarioOptions: InventarioOption[];
  unidadesProductivas: string[];
  localidades: string[];
  usuariosSolicitantes: string[];
  currentUserName: string | null;
  canMutate: boolean;
  canApprove: boolean;
};

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

export function SolicitudForm({
  mode,
  initial,
  inventarioOptions,
  unidadesProductivas,
  localidades,
  usuariosSolicitantes,
  currentUserName,
  canMutate,
  canApprove,
}: SolicitudFormProps) {
  const tReq = useTranslations("compras.solicitudes");
  const tCommon = useTranslations("listados.common");
  const tAud = useTranslations("compras.solicitudes.auditoria");
  const tApr = useTranslations("compras.solicitudes.aprobaciones");
  const router = useRouter();

  const isCreate = mode === "create";
  const estado = initial?.estado ?? "Borrador";
  const readOnly = !canMutate;

  const [lines, setLines] = useState<DetalleLine[]>(() => {
    if (initial) return initial.detalle.length ? initial.detalle : [emptyLine()];
    return [emptyLine()];
  });

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: initial
      ? {
          solicitante: initial.solicitante,
          unidadProductiva: initial.unidadProductiva,
          localidad: initial.localidad,
          prioridad:
            initial.prioridad === "Urgente" ? "Urgente" : "Normal",
          fechaTentativa: toDateInput(initial.fechaTentativa),
          fechaLimite: toDateInput(initial.fechaLimite),
          notas: initial.notas ?? "",
        }
      : {
          solicitante: currentUserName ?? "",
          unidadProductiva: "",
          localidad: "",
          prioridad: "Normal",
          fechaTentativa: "",
          fechaLimite: "",
          notas: "",
        },
  });

  const [isSaving, startSave] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isApproving, startApprove] = useTransition();
  const [isRejecting, startReject] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [approveDecisions, setApproveDecisions] = useState<
    Map<number, { aprobada: boolean; cantidadAprobada: number }>
  >(new Map());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const validLines = useMemo(
    () =>
      lines.filter(
        (ln) =>
          ln.itemId != null &&
          typeof ln.cantidad === "number" &&
          Number.isFinite(ln.cantidad) &&
          ln.cantidad > 0,
      ),
    [lines],
  );

  const invalidLines = useMemo(
    () =>
      lines.filter(
        (ln) =>
          ln.itemId != null &&
          (typeof ln.cantidad !== "number" ||
            !Number.isFinite(ln.cantidad) ||
            ln.cantidad <= 0),
      ),
    [lines],
  );

  const duplicateItemIds = useMemo(() => {
    const seen = new Set<number>();
    const dup = new Set<number>();
    for (const ln of lines) {
      if (ln.itemId == null) continue;
      if (seen.has(ln.itemId)) dup.add(ln.itemId);
      else seen.add(ln.itemId);
    }
    return dup;
  }, [lines]);

  function buildPayload(values: FormValues) {
    return {
      solicitante: values.solicitante,
      unidadProductiva: values.unidadProductiva,
      localidad: values.localidad,
      prioridad: values.prioridad,
      fechaTentativa: values.fechaTentativa || undefined,
      fechaLimite: values.fechaLimite || undefined,
      notas: values.notas,
      detalle: validLines.map((ln) => ({
        id: ln.id,
        itemId: ln.itemId as number,
        cantidad: ln.cantidad as number,
        prioridadItem: ln.prioridadItem,
        notasItem: ln.notasItem || undefined,
      })),
    };
  }

  function handleSave(options: { andSubmit?: boolean } = {}) {
    if (duplicateItemIds.size > 0) {
      toast.error(tReq("lineas.duplicada"));
      return;
    }
    if (invalidLines.length > 0) {
      toast.error(tReq("lineas.cantidadInvalida"));
      return;
    }
    if (options.andSubmit && validLines.length === 0) {
      toast.error(tReq("avisos.sinLineas"));
      return;
    }
    form.handleSubmit((values) => {
      const payload = buildPayload(values);
      startSave(async () => {
        const result = isCreate
          ? await createSolicitud(payload)
          : await updateSolicitud(initial!.id, payload);
        if (!result.ok) {
          if (result.error === "invalid" && result.fieldErrors) {
            for (const [k, msg] of Object.entries(result.fieldErrors)) {
              form.setError(k as keyof FormValues, { message: msg });
            }
          } else if (result.error === "forbidden") {
            toast.error(tCommon("errorForbidden"));
          } else if (result.error === "wrong_estado") {
            toast.error(tReq("avisos.soloBorrador"));
          } else {
            toast.error(tCommon("errorGuardar"));
          }
          return;
        }
        toast.success(
          isCreate
            ? tReq("avisos.creadaExitoso", { id: result.id })
            : tReq("avisos.actualizadaExitoso", { id: result.id }),
        );
        if (options.andSubmit) {
          const submitResult = await submitSolicitud(result.id);
          if (submitResult.ok) {
            toast.success(
              tReq("avisos.enviadaExitoso", { id: result.id }),
            );
          } else if (submitResult.error === "empty_detalle") {
            toast.error(tReq("avisos.sinLineas"));
          } else {
            toast.error(tReq("avisos.creadaSinEnviar"));
          }
        }
        router.push(`/compras/solicitudes/${result.id}`);
        router.refresh();
      });
    })();
  }

  function handleSubmitToReview() {
    if (!initial) return;
    if (duplicateItemIds.size > 0) {
      toast.error(tReq("lineas.duplicada"));
      return;
    }
    if (invalidLines.length > 0) {
      toast.error(tReq("lineas.cantidadInvalida"));
      return;
    }
    if (validLines.length === 0) {
      toast.error(tReq("avisos.sinLineas"));
      return;
    }
    form.handleSubmit((values) => {
      const payload = buildPayload(values);
      startSubmit(async () => {
        const saveResult = await updateSolicitud(initial.id, payload);
        if (!saveResult.ok) {
          if (saveResult.error === "invalid" && saveResult.fieldErrors) {
            for (const [k, msg] of Object.entries(saveResult.fieldErrors)) {
              form.setError(k as keyof FormValues, { message: msg });
            }
          } else if (saveResult.error === "forbidden") {
            toast.error(tCommon("errorForbidden"));
          } else if (saveResult.error === "wrong_estado") {
            toast.error(tReq("avisos.soloBorrador"));
          } else {
            toast.error(tCommon("errorGuardar"));
          }
          return;
        }
        const result = await submitSolicitud(initial.id);
        if (result.ok) {
          toast.success(tReq("avisos.enviadaExitoso", { id: initial.id }));
          router.refresh();
        } else if (result.error === "empty_detalle") {
          toast.error(tReq("avisos.sinLineas"));
        } else if (result.error === "forbidden") {
          toast.error(tCommon("errorForbidden"));
        } else if (result.error === "wrong_estado") {
          toast.error(tReq("avisos.soloBorrador"));
        } else {
          toast.error(tCommon("errorGuardar"));
        }
      });
    })();
  }

  function openApproveDialog() {
    if (!initial) return;
    const init = new Map<
      number,
      { aprobada: boolean; cantidadAprobada: number }
    >();
    for (const d of initial.detalle) {
      if (d.id == null) continue;
      init.set(d.id, {
        aprobada: true,
        cantidadAprobada: (d.cantidad as number) ?? 0,
      });
    }
    setApproveDecisions(init);
    setApproveComment("");
    setApproveOpen(true);
  }

  function updateApproveDecision(
    detalleId: number,
    patch: Partial<{ aprobada: boolean; cantidadAprobada: number }>,
  ) {
    setApproveDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(detalleId);
      if (!current) return prev;
      next.set(detalleId, { ...current, ...patch });
      return next;
    });
  }

  const approveDetalle = useMemo(() => {
    if (!initial) return [];
    return initial.detalle
      .filter((d) => d.id != null)
      .map((d) => {
        const item = d.itemId
          ? inventarioOptions.find((opt) => opt.id === d.itemId)
          : null;
        return {
          detalleId: d.id as number,
          itemCodigo: item?.codigo ?? "",
          itemDescripcion: item?.descripcion ?? "",
          unidadMedida: item?.unidadMedida ?? null,
          cantidadOriginal: (d.cantidad as number) ?? 0,
        };
      });
  }, [initial, inventarioOptions]);

  const approveAprobadasCount = useMemo(() => {
    let n = 0;
    for (const v of approveDecisions.values()) if (v.aprobada) n += 1;
    return n;
  }, [approveDecisions]);

  const approveHasInvalidQty = useMemo(() => {
    for (const d of approveDetalle) {
      const dec = approveDecisions.get(d.detalleId);
      if (!dec || !dec.aprobada) continue;
      if (
        !Number.isFinite(dec.cantidadAprobada) ||
        dec.cantidadAprobada <= 0 ||
        dec.cantidadAprobada > d.cantidadOriginal
      )
        return true;
    }
    return false;
  }, [approveDetalle, approveDecisions]);

  function handleApprove() {
    if (!initial) return;
    if (approveAprobadasCount === 0) {
      toast.error(tApr("avisos.aprobarSinLineas"));
      return;
    }
    if (approveHasInvalidQty) {
      toast.error(tApr("avisos.cantidadAprobadaInvalida"));
      return;
    }
    const payloadLineas = approveDetalle.map((d) => {
      const dec = approveDecisions.get(d.detalleId)!;
      return {
        detalleId: d.detalleId,
        aprobada: dec.aprobada,
        cantidadAprobada: dec.aprobada ? dec.cantidadAprobada : undefined,
      };
    });
    startApprove(async () => {
      const result = await approveSolicitud(initial.id, {
        comentario: approveComment.trim() || undefined,
        lineas: payloadLineas,
      });
      if (result.ok) {
        toast.success(tApr("avisos.aprobadaExitoso", { id: initial.id }));
        setApproveOpen(false);
        setApproveComment("");
        router.refresh();
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "wrong_estado") {
        toast.error(tApr("avisos.yaNoEsEnRevision"));
      } else if (result.error === "empty_detalle") {
        toast.error(tApr("avisos.aprobarSinLineas"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  function handleReject() {
    if (!initial) return;
    const motivo = rejectMotivo.trim();
    if (!motivo) {
      setRejectError(tApr("motivoRequerido"));
      return;
    }
    setRejectError(null);
    startReject(async () => {
      const result = await rejectSolicitud(initial.id, { motivo });
      if (result.ok) {
        toast.success(tApr("avisos.rechazadaExitoso", { id: initial.id }));
        setRejectOpen(false);
        setRejectMotivo("");
        router.refresh();
      } else if (result.error === "invalid" && result.fieldErrors?.motivo) {
        setRejectError(result.fieldErrors.motivo);
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "wrong_estado") {
        toast.error(tApr("avisos.yaNoEsEnRevision"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  function handleDelete() {
    if (!initial) return;
    startDelete(async () => {
      const result = await deleteSolicitud(initial.id);
      if (result.ok) {
        toast.success(tReq("avisos.eliminadaExitoso", { id: initial.id }));
        router.push("/compras/solicitudes");
        router.refresh();
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else if (result.error === "wrong_estado") {
        toast.error(tReq("avisos.soloBorrador"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  }

  const upOptions = unidadesProductivas.map((u) => ({ value: u, label: u }));
  const localidadOptions = localidades.map((l) => ({ value: l, label: l }));
  const solicitanteOptions = usuariosSolicitantes.map((u) => ({
    value: u,
    label: u,
  }));

  const title = isCreate
    ? tReq("nueva")
    : `${tReq("titulo")} #${initial?.id}`;
  const description = isCreate
    ? tReq("nuevaDescripcion")
    : `${format(new Date(initial!.fechaCreacion), "dd/MM/yyyy", { locale: es })} · ${initial!.solicitante}`;

  const showActions = !isCreate && initial;

  return (
    <div
      className={cn(
        "flex flex-col gap-6 p-6",
        isCreate ? "mx-auto w-full max-w-4xl pb-28" : "",
      )}
    >
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/compras/solicitudes">
            <ArrowLeft className="size-4" />
            {tReq("volver")}
          </Link>
        </Button>
        <PageHeader
          title={title}
          description={description}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {showActions && <EstadoChip estado={estado} />}
              {showActions && canMutate && estado === "Borrador" ? (
                <>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isDeleting}
                      >
                        <Trash2 className="size-4" />
                        {tCommon("eliminar")}
                      </Button>
                    }
                    title={tReq("avisos.eliminarPregunta", { id: initial.id })}
                    description={tReq("avisos.eliminarAviso")}
                    confirmLabel={tCommon("eliminar")}
                    destructive
                    onConfirm={handleDelete}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        disabled={isSubmitting || validLines.length === 0}
                      >
                        <Send className="size-4" />
                        {tReq("acciones.enviarRevision")}
                      </Button>
                    }
                    title={tReq("avisos.enviarConfirmacion", {
                      id: initial.id,
                    })}
                    description={tReq("avisos.enviarAviso")}
                    confirmLabel={tReq("acciones.enviarRevision")}
                    onConfirm={handleSubmitToReview}
                  />
                </>
              ) : null}
              {showActions && canApprove && estado === "En Revisión" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={isRejecting || isApproving}
                  >
                    <X className="size-4" />
                    {tApr("acciones.rechazar")}
                  </Button>
                  <Button
                    type="button"
                    onClick={openApproveDialog}
                    disabled={isApproving || isRejecting}
                  >
                    <Check className="size-4" />
                    {tApr("acciones.aprobar")}
                  </Button>
                </>
              ) : null}
              {showActions &&
              (estado === "Aprobada" || estado === "Asignado a Proveedor") ? (
                <Button asChild variant="outline">
                  <Link href="/compras/oc">
                    <ArrowUpRight className="size-4" />
                    {tReq("acciones.verEnOc")}
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      {!isCreate && initial && estado !== "Borrador" ? (
        <SolicitudStatusBanner
          estado={estado}
          initial={initial}
          lines={lines}
          tAud={tAud}
          tApr={tApr}
          tReq={tReq}
        />
      ) : null}

      <Form {...form}>
        <div
          className={cn(
            "grid gap-6",
            !isCreate ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "",
          )}
        >
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold">
                    {tReq("datosGeneralesTitulo")}
                  </h2>
                </div>
                <FormField
                  control={form.control}
                  name="prioridad"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {tReq("campos.prioridad")}
                      </FormLabel>
                      <FormControl>
                        <div
                          className="inline-flex rounded-md border border-border p-0.5"
                          role="radiogroup"
                          aria-label={tReq("campos.prioridad")}
                        >
                          {["Normal", "Urgente"].map((p) => {
                            const active = field.value === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={readOnly}
                                onClick={() => field.onChange(p)}
                                className={cn(
                                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                                  active
                                    ? p === "Urgente"
                                      ? "bg-destructive text-destructive-foreground"
                                      : "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                                  readOnly
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer",
                                )}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="solicitante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tReq("campos.solicitante")} *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={solicitanteOptions}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="unidadProductiva"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tReq("campos.unidadProductiva")} *</FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onChange={field.onChange}
                          options={upOptions}
                          disabled={readOnly}
                          autoFocus={isCreate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="localidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tReq("campos.localidad")} *</FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onChange={field.onChange}
                          options={localidadOptions}
                          disabled={readOnly}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fechaTentativa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tReq("campos.fechaTentativa")}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-9"
                          {...field}
                          disabled={readOnly}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        {tReq("campos.fechaTentativaHelper")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fechaLimite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tReq("campos.fechaLimite")}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-9"
                          {...field}
                          disabled={readOnly}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        {tReq("campos.fechaLimiteHelper")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tReq("campos.notas")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        {...field}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold">
                    {tReq("itemsTitulo")}
                  </h2>
                  {canMutate ? (
                    <p className="text-xs text-muted-foreground">
                      {tReq("itemsAyuda")}
                    </p>
                  ) : null}
                </div>
                {estado !== "Borrador" && estado !== "En Revisión" ? (
                  (() => {
                    const aprobadas = lines.filter(
                      (l) => l.estadoLinea && l.estadoLinea !== "Rechazada",
                    ).length;
                    const rechazadas = lines.filter(
                      (l) => l.estadoLinea === "Rechazada",
                    ).length;
                    return (
                      <span className="text-xs text-muted-foreground">
                        {rechazadas > 0
                          ? tReq("campos.lineasResumen", {
                              aprobadas,
                              rechazadas,
                            })
                          : tReq("campos.lineasCount", {
                              count: aprobadas,
                            })}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {tReq("campos.lineasCount", { count: validLines.length })}
                  </span>
                )}
              </div>
              <DetalleLinesEditor
                lines={lines}
                onChange={setLines}
                inventarioOptions={inventarioOptions}
                readOnly={readOnly}
              />
            </section>

            {canMutate && !isCreate ? (
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSaving}
                >
                  {tCommon("cancelar")}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                >
                  {isSaving
                    ? tCommon("guardando")
                    : tReq("acciones.guardar")}
                </Button>
              </div>
            ) : null}
          </div>

          {initial ? (
            <aside className="flex flex-col gap-4 text-sm lg:sticky lg:top-4 lg:self-start">
              {initial.ocsVinculadas.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {tAud("ocsVinculadas")}
                    </h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {initial.ocsVinculadas.length}
                    </span>
                  </div>
                  <ul className="-mx-1 flex flex-col">
                    {initial.ocsVinculadas.map((oc) => (
                      <li key={oc.id}>
                        <Link
                          href={`/compras/oc/${oc.id}`}
                          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                        >
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="font-mono text-xs">
                              {oc.numeroOc ?? `#${oc.id}`}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {oc.proveedor}
                            </span>
                          </div>
                          <EstadoChip estado={oc.estado} className="text-[10px]" />
                          <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tAud("titulo")}
                </h2>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <div>
                    {initial.creadoPor
                      ? tAud("creadaPor", {
                          nombre: initial.creadoPor,
                          fecha: formatDateTime(initial.fechaCreacion),
                        })
                      : tAud("sinDatos")}
                  </div>
                  {initial.aprobadoPor && initial.fechaAprobacion ? (
                    <div>
                      {tAud("aprobadaPor", {
                        nombre: initial.aprobadoPor,
                        fecha: formatDateTime(initial.fechaAprobacion),
                      })}
                    </div>
                  ) : null}
                  {initial.estado !== "Rechazada" &&
                  initial.canceladoPor &&
                  initial.fechaCancelacion ? (
                    <div>
                      {tAud("canceladaPor", {
                        nombre: initial.canceladoPor,
                        fecha: formatDateTime(initial.fechaCancelacion),
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </Form>

      {isCreate && canMutate ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {tReq("campos.lineasCount", { count: validLines.length })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              {tCommon("cancelar")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              {isSaving ? tCommon("guardando") : tReq("acciones.crear")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave({ andSubmit: true })}
              disabled={isSaving || validLines.length === 0}
            >
              <Send className="size-4" />
              {tReq("acciones.crearYEnviar")}
            </Button>
          </div>
        </div>
      ) : null}

      {initial ? (
        <>
          <Dialog
            open={approveOpen}
            onOpenChange={(open) => {
              if (!isApproving) setApproveOpen(open);
              if (!open) setApproveComment("");
            }}
          >
            <DialogContent className="flex max-h-[calc(100vh-5rem)] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
              <DialogHeader className="border-b border-border px-6 py-4">
                <DialogTitle className="text-lg">
                  {tApr("aprobarTitulo", { id: initial.id })}
                </DialogTitle>
                <DialogDescription>
                  {tApr("aprobarDescripcionParcial")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tApr("aprobar.lineasCount", {
                    count: approveDetalle.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isApproving}
                    onClick={() => {
                      setApproveDecisions((prev) => {
                        const next = new Map(prev);
                        for (const d of approveDetalle) {
                          next.set(d.detalleId, {
                            aprobada: true,
                            cantidadAprobada: d.cantidadOriginal,
                          });
                        }
                        return next;
                      });
                    }}
                  >
                    {tApr("aprobar.seleccionarTodas")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isApproving}
                    onClick={() => {
                      setApproveDecisions((prev) => {
                        const next = new Map(prev);
                        for (const d of approveDetalle) {
                          const current = next.get(d.detalleId);
                          next.set(d.detalleId, {
                            aprobada: false,
                            cantidadAprobada:
                              current?.cantidadAprobada ?? d.cantidadOriginal,
                          });
                        }
                        return next;
                      });
                    }}
                  >
                    {tApr("aprobar.deseleccionarTodas")}
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6">
                <div className="flex flex-col gap-2">
                  {approveDetalle.map((d) => {
                    const dec = approveDecisions.get(d.detalleId);
                    const aprobada = dec?.aprobada ?? false;
                    const qty = dec?.cantidadAprobada ?? d.cantidadOriginal;
                    const over = qty > d.cantidadOriginal + 1e-9;
                    const zero = aprobada && qty <= 0;
                    const invalid = aprobada && (over || zero);
                    const parcial =
                      aprobada && !invalid && qty < d.cantidadOriginal;
                    return (
                      <div
                        key={d.detalleId}
                        className={cn(
                          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border p-3 transition-colors",
                          aprobada
                            ? invalid
                              ? "border-destructive/50 bg-destructive/5"
                              : parcial
                                ? "border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/20"
                                : "border-border hover:bg-muted/20"
                            : "border-dashed border-border bg-muted/10",
                        )}
                      >
                        <Checkbox
                          checked={aprobada}
                          onCheckedChange={(v) =>
                            updateApproveDecision(d.detalleId, {
                              aprobada: v === true,
                            })
                          }
                          aria-label={tApr("aprobar.columnas.aprobada")}
                          disabled={isApproving}
                          className="size-5"
                        />
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {d.itemCodigo || "—"}
                            </span>
                            {parcial ? (
                              <Badge
                                variant="secondary"
                                className="h-5 border-transparent bg-amber-100 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                              >
                                {tApr("aprobar.ajustada")}
                              </Badge>
                            ) : null}
                            {!aprobada ? (
                              <Badge
                                variant="secondary"
                                className="h-5 border-transparent bg-destructive/10 text-[10px] font-medium uppercase tracking-wide text-destructive"
                              >
                                {tApr("aprobar.rechazadaBadge")}
                              </Badge>
                            ) : null}
                          </div>
                          <div
                            className={cn(
                              "truncate text-sm font-medium",
                              aprobada
                                ? ""
                                : "text-muted-foreground line-through",
                            )}
                          >
                            {d.itemDescripcion || "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {tApr("aprobar.pedidaInline", {
                              cantidad: d.cantidadOriginal,
                              unidad: d.unidadMedida ?? "",
                            })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <QtyStepper
                              value={aprobada ? qty : 0}
                              onChange={(v) =>
                                updateApproveDecision(d.detalleId, {
                                  cantidadAprobada: v,
                                })
                              }
                              min={0}
                              max={d.cantidadOriginal}
                              size="md"
                              disabled={!aprobada || isApproving}
                            />
                            <span className="min-w-[48px] text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {d.unidadMedida ?? "—"}
                            </span>
                          </div>
                          <div className="flex w-full items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  !aprobada || invalid
                                    ? "bg-destructive/40"
                                    : parcial
                                      ? "bg-amber-400"
                                      : "bg-primary",
                                )}
                                style={{
                                  width: `${Math.min(100, Math.max(0, aprobada ? (qty / d.cantidadOriginal) * 100 : 0))}%`,
                                }}
                              />
                            </div>
                            <span className="tabular-nums text-[11px] text-muted-foreground whitespace-nowrap">
                              {aprobada ? qty : 0} / {d.cantidadOriginal}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Label
                    htmlFor="approve-comment"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {tApr("comentarioOpcional")}
                  </Label>
                  <Textarea
                    id="approve-comment"
                    rows={2}
                    value={approveComment}
                    onChange={(e) => setApproveComment(e.target.value)}
                    disabled={isApproving}
                    placeholder={tApr("aprobar.comentarioPlaceholder")}
                  />
                </div>
              </div>

              <DialogFooter className="mx-0 mb-0 flex flex-col items-stretch gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {tApr("aprobar.resumen", {
                      aprobadas: approveAprobadasCount,
                      total: approveDetalle.length,
                    })}
                  </span>
                  {approveAprobadasCount === 0 ? (
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {tApr("aprobar.usarRechazar")}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApproveOpen(false)}
                    disabled={isApproving}
                  >
                    {tCommon("cancelar")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApprove}
                    disabled={
                      isApproving ||
                      approveAprobadasCount === 0 ||
                      approveHasInvalidQty
                    }
                  >
                    <Check className="size-4" />
                    {isApproving
                      ? tCommon("guardando")
                      : tApr("aprobar.accion", {
                          aprobadas: approveAprobadasCount,
                          total: approveDetalle.length,
                        })}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={rejectOpen}
            onOpenChange={(open) => {
              if (!isRejecting) setRejectOpen(open);
              if (!open) {
                setRejectMotivo("");
                setRejectError(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {tApr("rechazarTitulo", { id: initial.id })}
                </DialogTitle>
                <DialogDescription>
                  {tApr("rechazarDescripcion")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reject-motivo" className="text-sm">
                  {tApr("motivoRequeridoLabel")} *
                </Label>
                <Textarea
                  id="reject-motivo"
                  rows={4}
                  value={rejectMotivo}
                  onChange={(e) => {
                    setRejectMotivo(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  disabled={isRejecting}
                  aria-invalid={rejectError ? true : undefined}
                />
                {rejectError ? (
                  <p className="text-xs text-destructive">{rejectError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectOpen(false)}
                  disabled={isRejecting}
                >
                  {tCommon("cancelar")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isRejecting}
                >
                  {isRejecting
                    ? tCommon("guardando")
                    : tApr("acciones.rechazar")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function SolicitudStatusBanner({
  estado,
  initial,
  lines,
  tAud,
  tApr,
  tReq,
}: {
  estado: string;
  initial: SolicitudDetail;
  lines: DetalleLine[];
  tAud: ReturnType<typeof useTranslations>;
  tApr: ReturnType<typeof useTranslations>;
  tReq: ReturnType<typeof useTranslations>;
}) {
  const tone =
    estado === "Rechazada"
      ? "destructive"
      : estado === "En Revisión"
        ? "amber"
        : estado === "OC Emitida" || estado === "Asignado a Proveedor"
          ? "sky"
          : estado === "Aprobada"
            ? "emerald"
            : "muted";

  const toneClasses: Record<string, string> = {
    destructive:
      "border-destructive/30 bg-destructive/5 text-destructive",
    amber:
      "border-amber-300/60 bg-amber-50/70 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100",
    sky: "border-sky-300/60 bg-sky-50/70 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-100",
    emerald:
      "border-emerald-300/60 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    muted: "border-border bg-muted/40 text-foreground",
  };

  const iconTone: Record<string, string> = {
    destructive:
      "bg-destructive/15 text-destructive",
    amber:
      "bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
    sky: "bg-sky-200/70 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100",
    emerald:
      "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
    muted: "bg-muted text-foreground",
  };

  const Icon =
    estado === "Rechazada"
      ? X
      : estado === "En Revisión"
        ? Send
        : estado === "Aprobada" ||
            estado === "Asignado a Proveedor" ||
            estado === "OC Emitida"
          ? Check
          : Send;

  const aprobadas = lines.filter(
    (l) => l.estadoLinea && l.estadoLinea !== "Rechazada",
  ).length;
  const rechazadas = lines.filter(
    (l) => l.estadoLinea === "Rechazada",
  ).length;

  function primaryLine(): string {
    if (
      estado === "Rechazada" &&
      initial.canceladoPor &&
      initial.fechaCancelacion
    ) {
      return tAud("rechazadaPor", {
        nombre: initial.canceladoPor,
        fecha: formatDateTime(initial.fechaCancelacion),
      });
    }
    if (estado === "En Revisión") {
      return tAud("aprobacionPendiente");
    }
    if (
      (estado === "Aprobada" ||
        estado === "Asignado a Proveedor" ||
        estado === "OC Emitida") &&
      initial.aprobadoPor &&
      initial.fechaAprobacion
    ) {
      return tAud("aprobadaPor", {
        nombre: initial.aprobadoPor,
        fecha: formatDateTime(initial.fechaAprobacion),
      });
    }
    return initial.creadoPor
      ? tAud("creadaPor", {
          nombre: initial.creadoPor,
          fecha: formatDateTime(initial.fechaCreacion),
        })
      : tAud("sinDatos");
  }

  const showLineasSummary =
    (estado === "Aprobada" ||
      estado === "Asignado a Proveedor" ||
      estado === "OC Emitida") &&
    rechazadas > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start",
        toneClasses[tone],
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          iconTone[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <EstadoChip estado={estado} />
          {showLineasSummary ? (
            <span className="text-xs text-muted-foreground">
              {tReq("campos.lineasResumen", { aprobadas, rechazadas })}
            </span>
          ) : null}
        </div>
        <p className="text-sm font-medium">{primaryLine()}</p>
        {estado === "Rechazada" && initial.motivoRechazo ? (
          <div className="mt-1 rounded-md border border-destructive/30 bg-background/60 p-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
              {tApr("motivoRechazo")}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-foreground">
              {initial.motivoRechazo}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
