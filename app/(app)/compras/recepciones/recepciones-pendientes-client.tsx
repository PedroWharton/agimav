"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PackageOpen, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Combobox } from "@/components/app/combobox";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";

import { createRecepcion } from "./actions";

export type RecepcionPendienteLinea = {
  ocDetalleId: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  pendiente: number;
};

export type RecepcionPendienteOc = {
  id: number;
  numeroOc: string;
  fechaEmision: string;
  proveedor: string;
  estado: string;
  totalLineas: number;
  pendientesLineas: number;
  lineas: RecepcionPendienteLinea[];
};

const PROV_ALL = "__all__";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RecepcionesPendientesClient({
  ocs,
  proveedores,
}: {
  ocs: RecepcionPendienteOc[];
  proveedores: string[];
}) {
  const tRec = useTranslations("compras.recepciones");
  const [search, setSearch] = useState("");
  const [provFilter, setProvFilter] = useState<string>(PROV_ALL);
  const [activeOcId, setActiveOcId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return ocs.filter((oc) => {
      if (provFilter !== PROV_ALL && oc.proveedor !== provFilter) return false;
      if (q) {
        const hay =
          norm(oc.numeroOc).includes(q) || norm(oc.proveedor).includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [ocs, search, provFilter]);

  const activeOc = useMemo(
    () => (activeOcId != null ? ocs.find((o) => o.id === activeOcId) ?? null : null),
    [ocs, activeOcId],
  );

  if (ocs.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title={tRec("pendientes.vacio.titulo")}
        description={tRec("pendientes.vacio.descripcion")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <Toolbar.Search
          value={search}
          onValueChange={setSearch}
          placeholder={tRec("pendientes.buscarPlaceholder")}
        />
        <Toolbar.Selects>
          <Combobox
            value={provFilter === PROV_ALL ? "" : provFilter}
            onChange={(v) => setProvFilter(v || PROV_ALL)}
            options={[
              { value: "", label: tRec("filtros.todos") },
              ...proveedores.map((p) => ({ value: p, label: p })),
            ]}
            placeholder={tRec("filtros.proveedor")}
            allowCreate={false}
            className="h-9 w-[240px]"
          />
        </Toolbar.Selects>
      </Toolbar>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-28">
                {tRec("campos.oc")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-28">
                {tRec("campos.fecha")}
              </th>
              <th className="px-2 py-2 text-left font-medium">
                {tRec("campos.proveedor")}
              </th>
              <th className="px-2 py-2 text-left font-medium w-36">
                {tRec("campos.estado")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-28">
                {tRec("pendientes.columnas.pendientes")}
              </th>
              <th className="px-2 py-2 text-right font-medium w-[260px]">
                <span className="sr-only">{tRec("pendientes.acciones.recibir")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {tRec("avisos.vacioFiltrado")}
                </td>
              </tr>
            ) : null}
            {filtered.map((oc) => (
              <tr key={oc.id} className="border-t border-border">
                <td className="px-2 py-2 font-mono text-xs">
                  <Link
                    href={`/compras/oc/${oc.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {oc.numeroOc}
                  </Link>
                </td>
                <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(oc.fechaEmision), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </td>
                <td className="px-2 py-2">{oc.proveedor}</td>
                <td className="px-2 py-2">
                  <Badge
                    variant="secondary"
                    className={
                      oc.estado === "Parcialmente Recibida"
                        ? "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                        : "border-transparent bg-muted text-muted-foreground"
                    }
                  >
                    {oc.estado}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {oc.pendientesLineas} / {oc.totalLineas}
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/compras/recepciones/nueva?oc=${oc.id}`}
                        title={tRec("pendientes.acciones.vistaCompleta")}
                      >
                        <Settings2 className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setActiveOcId(oc.id)}
                    >
                      <PackageOpen className="size-4" />
                      {tRec("pendientes.acciones.recibir")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecibirModal
        oc={activeOc}
        onClose={() => setActiveOcId(null)}
      />
    </div>
  );
}

function RecibirModal({
  oc,
  onClose,
}: {
  oc: RecepcionPendienteOc | null;
  onClose: () => void;
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  const [numeroRemito, setNumeroRemito] = useState("");
  const [fecha, setFecha] = useState<string>(todayISODate());
  const [recibidoPor, setRecibidoPor] = useState("");
  const [notas, setNotas] = useState("");
  const [qtyById, setQtyById] = useState<Record<number, number>>({});

  // Reset state every time a different OC opens.
  useEffect(() => {
    if (!oc) return;
    setNumeroRemito("");
    setFecha(todayISODate());
    setRecibidoPor("");
    setNotas("");
    const next: Record<number, number> = {};
    for (const l of oc.lineas) next[l.ocDetalleId] = l.pendiente;
    setQtyById(next);
  }, [oc]);

  const pendientesById = useMemo(() => {
    const m = new Map<number, number>();
    if (oc) for (const l of oc.lineas) m.set(l.ocDetalleId, l.pendiente);
    return m;
  }, [oc]);

  const totalRecibir = useMemo(
    () => Object.values(qtyById).reduce((a, b) => a + b, 0),
    [qtyById],
  );
  const overReception = useMemo(() => {
    for (const [idStr, qty] of Object.entries(qtyById)) {
      const pendiente = pendientesById.get(Number(idStr)) ?? 0;
      if (qty > pendiente + 1e-9) return true;
    }
    return false;
  }, [qtyById, pendientesById]);

  const canSave =
    !isSaving &&
    oc != null &&
    numeroRemito.trim().length > 0 &&
    recibidoPor.trim().length > 0 &&
    totalRecibir > 0 &&
    !overReception;

  const updateQty = (id: number, raw: number) => {
    const pendiente = pendientesById.get(id) ?? 0;
    const clamped = Math.max(0, Math.min(raw, pendiente));
    setQtyById((prev) => ({ ...prev, [id]: clamped }));
  };

  const recibirTodo = () => {
    if (!oc) return;
    const next: Record<number, number> = {};
    for (const l of oc.lineas) next[l.ocDetalleId] = l.pendiente;
    setQtyById(next);
  };

  const handleSave = () => {
    if (!oc) return;
    startSave(async () => {
      const payload = {
        ocId: oc.id,
        numeroRemito: numeroRemito.trim(),
        fechaRecepcion: new Date(fecha),
        recibidoPor: recibidoPor.trim(),
        observaciones: notas.trim() || null,
        lineas: Object.entries(qtyById)
          .filter(([, qty]) => qty > 0)
          .map(([idStr, qty]) => ({
            ocDetalleId: Number(idStr),
            cantidadRecibidaAhora: qty,
            destino: "Stock" as const,
            observaciones: null,
          })),
      };
      const result = await createRecepcion(payload);
      if (result.ok) {
        toast.success(tRec("avisos.creadaExitoso", { id: result.id }));
        onClose();
        router.refresh();
      } else if (result.error === "over_reception") {
        toast.error(tRec("avisos.sobreRecepcion"));
      } else if (result.error === "wrong_estado") {
        toast.error(tRec("avisos.ocNoRecibible"));
      } else if (result.error === "nothing_to_receive") {
        toast.error(tRec("avisos.nadaParaRecibir"));
      } else if (result.error === "forbidden") {
        toast.error(tCommon("errorForbidden"));
      } else {
        toast.error(tCommon("errorGuardar"));
      }
    });
  };

  return (
    <Dialog
      open={oc != null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        {oc ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {tRec("pendientes.modal.titulo", {
                  numero: oc.numeroOc,
                  proveedor: oc.proveedor,
                })}
              </DialogTitle>
              <DialogDescription>
                {tRec("pendientes.modal.descripcion")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="modal-remito">{tRec("campos.remito")}</Label>
                <Input
                  id="modal-remito"
                  value={numeroRemito}
                  onChange={(e) => setNumeroRemito(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="modal-fecha">{tRec("campos.fecha")}</Label>
                <Input
                  id="modal-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="modal-recibidoPor">
                  {tRec("campos.recibidoPor")}
                </Label>
                <Input
                  id="modal-recibidoPor"
                  value={recibidoPor}
                  onChange={(e) => setRecibidoPor(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {tRec("pendientes.modal.ayudaCantidad")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={recibirTodo}
                disabled={isSaving}
              >
                {tRec("acciones.recibirTodo")}
              </Button>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium w-24">
                      {tRec("columnas.codigo")}
                    </th>
                    <th className="px-2 py-2 text-left font-medium">
                      {tRec("columnas.descripcion")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium w-20">
                      {tRec("columnas.pendiente")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium w-28">
                      {tRec("columnas.recibirAhora")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {oc.lineas.map((l) => {
                    const qty = qtyById[l.ocDetalleId] ?? 0;
                    const over = qty > l.pendiente + 1e-9;
                    return (
                      <tr key={l.ocDetalleId} className="border-t border-border">
                        <td className="px-2 py-2 font-mono text-xs">
                          {l.itemCodigo || "—"}
                        </td>
                        <td className="px-2 py-2">
                          {l.itemDescripcion || "—"}
                          {l.unidadMedida ? (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              · {l.unidadMedida}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {l.pendiente}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={l.pendiente}
                            step="any"
                            value={qty}
                            onChange={(e) =>
                              updateQty(
                                l.ocDetalleId,
                                Number(e.target.value) || 0,
                              )
                            }
                            disabled={isSaving}
                            aria-invalid={over || undefined}
                            className="h-8 w-24 text-right"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="modal-notas">
                {tRec("resumenSidebar.notas")}
              </Label>
              <Textarea
                id="modal-notas"
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                disabled={isSaving}
                placeholder={tRec("resumenSidebar.notasPlaceholder")}
              />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/compras/recepciones/nueva?oc=${oc.id}`}>
                  {tRec("pendientes.modal.vistaCompleta")}
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  {tRec("footer.cancelar")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {isSaving
                    ? tRec("footer.guardando")
                    : tRec("footer.confirmar")}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
