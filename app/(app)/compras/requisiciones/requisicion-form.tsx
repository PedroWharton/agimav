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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Combobox } from "@/components/app/combobox";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EstadoChip } from "@/components/compras/estado-chip";
import {
  DetalleLinesEditor,
  type DetalleLine,
  type InventarioOption,
  emptyLine,
} from "@/components/compras/detalle-lines-editor";

import {
  createRequisicion,
  updateRequisicion,
  deleteRequisicion,
  submitRequisicion,
  approveRequisicion,
  rejectRequisicion,
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

export type RequisicionDetail = {
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

export type RequisicionFormProps = {
  mode: "create" | "edit";
  initial: RequisicionDetail | null;
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

export function RequisicionForm({
  mode,
  initial,
  inventarioOptions,
  unidadesProductivas,
  localidades,
  usuariosSolicitantes,
  currentUserName,
  canMutate,
  canApprove,
}: RequisicionFormProps) {
  const tReq = useTranslations("compras.requisiciones");
  const tCommon = useTranslations("listados.common");
  const tAud = useTranslations("compras.requisiciones.auditoria");
  const tApr = useTranslations("compras.requisiciones.aprobaciones");
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

  function handleSave() {
    if (duplicateItemIds.size > 0) {
      toast.error(tReq("lineas.duplicada"));
      return;
    }
    form.handleSubmit((values) => {
      const payload = buildPayload(values);
      startSave(async () => {
        const result = isCreate
          ? await createRequisicion(payload)
          : await updateRequisicion(initial!.id, payload);
        if (result.ok) {
          toast.success(
            isCreate
              ? tReq("avisos.creadaExitoso", { id: result.id })
              : tReq("avisos.actualizadaExitoso", { id: result.id }),
          );
          router.push(`/compras/requisiciones/${result.id}`);
          router.refresh();
        } else if (result.error === "invalid" && result.fieldErrors) {
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
      });
    })();
  }

  function handleSubmitToReview() {
    if (!initial) return;
    if (validLines.length === 0) {
      toast.error(tReq("avisos.sinLineas"));
      return;
    }
    startSubmit(async () => {
      const result = await submitRequisicion(initial.id);
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
  }

  function handleApprove() {
    if (!initial) return;
    startApprove(async () => {
      const result = await approveRequisicion(initial.id, {
        comentario: approveComment.trim() || undefined,
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
      const result = await rejectRequisicion(initial.id, { motivo });
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
      const result = await deleteRequisicion(initial.id);
      if (result.ok) {
        toast.success(tReq("avisos.eliminadaExitoso", { id: initial.id }));
        router.push("/compras/requisiciones");
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
    ? tReq("descripcion")
    : `${format(new Date(initial!.fechaCreacion), "dd/MM/yyyy", { locale: es })} · ${initial!.solicitante}`;

  const showActions = !isCreate && initial;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/compras/requisiciones">
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
                    onClick={() => setApproveOpen(true)}
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

      <Form {...form}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-2 gap-3">
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
                <FormField
                  control={form.control}
                  name="prioridad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tReq("campos.prioridad")}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {tReq("lineas.titulo")}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {tReq("campos.lineasCount", { count: validLines.length })}
                </span>
              </div>
              <DetalleLinesEditor
                lines={lines}
                onChange={setLines}
                inventarioOptions={inventarioOptions}
                readOnly={readOnly}
              />
            </div>

            {canMutate ? (
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
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving
                    ? tCommon("guardando")
                    : isCreate
                      ? tReq("acciones.crear")
                      : tReq("acciones.guardar")}
                </Button>
              </div>
            ) : null}
          </div>

          {initial ? (
            <aside className="flex flex-col gap-2 rounded-md border border-border p-4 text-sm lg:sticky lg:top-4 lg:self-start">
              <h2 className="text-sm font-medium">{tAud("titulo")}</h2>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
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
                ) : initial.estado === "En Revisión" ? (
                  <div>{tAud("aprobacionPendiente")}</div>
                ) : null}
                {initial.estado === "Rechazada" &&
                initial.canceladoPor &&
                initial.fechaCancelacion ? (
                  <div>
                    {tAud("rechazadaPor", {
                      nombre: initial.canceladoPor,
                      fecha: formatDateTime(initial.fechaCancelacion),
                    })}
                  </div>
                ) : initial.canceladoPor && initial.fechaCancelacion ? (
                  <div>
                    {tAud("canceladaPor", {
                      nombre: initial.canceladoPor,
                      fecha: formatDateTime(initial.fechaCancelacion),
                    })}
                  </div>
                ) : null}
                {initial.motivoRechazo ? (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                    <div className="text-[11px] font-semibold uppercase tracking-wide">
                      {tApr("motivoRechazo")}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm">
                      {initial.motivoRechazo}
                    </div>
                  </div>
                ) : null}
              </div>

              {initial.ocsVinculadas.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tAud("ocsVinculadas")}
                  </div>
                  {initial.ocsVinculadas.map((oc) => (
                    <Link
                      key={oc.id}
                      href={`/compras/oc/${oc.id}`}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/60"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-mono text-xs">
                          {oc.numeroOc ?? `#${oc.id}`}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {oc.proveedor}
                        </span>
                      </span>
                      <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </Form>

      {initial ? (
        <>
          <Dialog
            open={approveOpen}
            onOpenChange={(open) => {
              if (!isApproving) setApproveOpen(open);
              if (!open) setApproveComment("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {tApr("aprobarTitulo", { id: initial.id })}
                </DialogTitle>
                <DialogDescription>
                  {tApr("aprobarDescripcion")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="approve-comment" className="text-sm">
                  {tApr("comentarioOpcional")}
                </Label>
                <Textarea
                  id="approve-comment"
                  rows={3}
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  disabled={isApproving}
                />
              </div>
              <DialogFooter>
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
                  disabled={isApproving}
                >
                  {isApproving ? tCommon("guardando") : tApr("acciones.aprobar")}
                </Button>
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
