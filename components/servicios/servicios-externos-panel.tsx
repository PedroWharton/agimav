"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Wrench, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { formatARS } from "@/lib/format";

import {
  agregarServicioExterno,
  actualizarServicioExterno,
  eliminarServicioExterno,
  type ServicioTarget,
} from "./actions";

export type ServicioExternoLine = {
  id: number;
  proveedorServicioId: number;
  proveedorNombre: string;
  descripcion: string;
  costo: number;
  precioPendiente: boolean;
  fecha: string | null;
};

type ProveedorOption = { id: number; nombre: string };

type DialogForm = {
  proveedorServicioId: string;
  descripcion: string;
  costo: string;
  precioPendiente: boolean;
  fecha: string;
};

const emptyForm: DialogForm = {
  proveedorServicioId: "",
  descripcion: "",
  costo: "",
  precioPendiente: false,
  fecha: "",
};

export function ServiciosExternosPanel({
  target,
  servicios,
  proveedores,
  canManage,
}: {
  target: ServicioTarget;
  servicios: ServicioExternoLine[];
  proveedores: ProveedorOption[];
  canManage: boolean;
}) {
  const t = useTranslations("serviciosExternos");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DialogForm>(emptyForm);
  const [busy, startBusy] = useTransition();

  const total = useMemo(
    () =>
      servicios
        .filter((s) => !s.precioPendiente)
        .reduce((acc, s) => acc + s.costo, 0),
    [servicios],
  );
  const pendientes = servicios.filter((s) => s.precioPendiente).length;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: ServicioExternoLine) {
    setEditingId(s.id);
    setForm({
      proveedorServicioId: String(s.proveedorServicioId),
      descripcion: s.descripcion,
      costo: s.precioPendiente ? "" : String(s.costo),
      precioPendiente: s.precioPendiente,
      fecha: s.fecha ? s.fecha.slice(0, 10) : "",
    });
    setOpen(true);
  }

  function submit() {
    const proveedorServicioId = Number(form.proveedorServicioId);
    if (!Number.isFinite(proveedorServicioId) || proveedorServicioId <= 0) {
      toast.error(t("errorProveedor"));
      return;
    }
    if (!form.descripcion.trim()) {
      toast.error(t("errorDescripcion"));
      return;
    }
    const payload = {
      proveedorServicioId,
      descripcion: form.descripcion.trim(),
      costo: form.precioPendiente ? 0 : Number(form.costo) || 0,
      precioPendiente: form.precioPendiente,
      fecha: form.fecha || undefined,
    };
    startBusy(async () => {
      const res = editingId
        ? await actualizarServicioExterno(editingId, payload)
        : await agregarServicioExterno(target, payload);
      if (res.ok) {
        toast.success(editingId ? t("avisoActualizado") : t("avisoAgregado"));
        setOpen(false);
      } else if (res.error === "forbidden") {
        toast.error(t("errorForbidden"));
      } else if (res.error === "invalid") {
        toast.error(t("errorInvalido"));
      } else {
        toast.error(t("errorGuardar"));
      }
    });
  }

  function onDelete(id: number) {
    startBusy(async () => {
      const res = await eliminarServicioExterno(id);
      if (res.ok) {
        toast.success(t("avisoEliminado"));
      } else if (res.error === "forbidden") {
        toast.error(t("errorForbidden"));
      } else {
        toast.error(t("errorGuardar"));
      }
    });
  }

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4 text-sky-600 dark:text-sky-400" />
          {t("panelTitulo")}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle-foreground">
            {t("total")}{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatARS(total)}
            </span>
          </span>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              onClick={openCreate}
              disabled={busy}
            >
              <Plus className="size-4" />
              {t("agregar")}
            </Button>
          ) : null}
        </div>
      </div>

      {pendientes > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("pendientesNota", { count: pendientes })}
        </p>
      ) : null}

      {servicios.length === 0 ? (
        <p className="text-sm text-subtle-foreground">{t("sinServicios")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {servicios.map((s) => (
            <li
              key={s.id}
              className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{s.proveedorNombre}</span>
                <span className="text-xs text-subtle-foreground">
                  {s.descripcion}
                </span>
                {s.fecha ? (
                  <span className="text-xs text-subtle-foreground">
                    {format(new Date(s.fecha), "dd/MM/yyyy", { locale: es })}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.precioPendiente ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {t("precioPendiente")}
                  </span>
                ) : (
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatARS(s.costo)}
                  </span>
                )}
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("editar")}
                      onClick={() => openEdit(s)}
                      disabled={busy}
                      className="size-7 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("eliminar")}
                          disabled={busy}
                          className="size-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                      title={t("eliminarPregunta")}
                      description={t("eliminarAviso")}
                      confirmLabel={t("eliminar")}
                      destructive
                      onConfirm={() => onDelete(s.id)}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("dialogTituloEditar") : t("dialogTituloNuevo")}
            </DialogTitle>
            <DialogDescription>{t("dialogDescripcion")}</DialogDescription>
          </DialogHeader>

          {proveedores.length === 0 ? (
            <p className="text-sm text-subtle-foreground">
              {t("sinProveedores")}{" "}
              <Link
                href="/listados/proveedores-servicio"
                className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
              >
                {t("sinProveedoresLink")}
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-proveedor">{t("proveedor")} *</Label>
                <Select
                  value={form.proveedorServicioId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, proveedorServicioId: v }))
                  }
                >
                  <SelectTrigger id="se-proveedor" className="w-full">
                    <SelectValue placeholder={t("proveedorPlaceholder")} />
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-descripcion">{t("descripcion")} *</Label>
                <Textarea
                  id="se-descripcion"
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descripcion: e.target.value }))
                  }
                  placeholder={t("descripcionPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="se-costo">{t("costo")}</Label>
                  <Input
                    id="se-costo"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.costo}
                    disabled={form.precioPendiente}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, costo: e.target.value }))
                    }
                    className="tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="se-fecha">{t("fecha")}</Label>
                  <Input
                    id="se-fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fecha: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="se-pendiente"
                  checked={form.precioPendiente}
                  onCheckedChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      precioPendiente: v === true,
                      costo: v === true ? "" : f.costo,
                    }))
                  }
                />
                <Label htmlFor="se-pendiente" className="font-normal">
                  {t("precioPendienteLabel")}
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {t("cancelar")}
            </Button>
            <Button
              onClick={submit}
              disabled={busy || proveedores.length === 0}
            >
              {t("guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
