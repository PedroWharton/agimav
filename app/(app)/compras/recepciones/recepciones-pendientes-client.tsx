"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Maximize2, PackageOpen } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
import { NumberInput } from "@/components/app/number-input";
import { EmptyState } from "@/components/app/states";
import { Toolbar } from "@/components/app/toolbar";
import { EstadoChip } from "@/components/compras/estado-chip";

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
  usuarios,
  defaultRecibidoPor,
}: {
  ocs: RecepcionPendienteOc[];
  proveedores: string[];
  usuarios: string[];
  defaultRecibidoPor: string;
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
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-32">
                {tRec("campos.oc")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {tRec("campos.proveedor")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-40">
                {tRec("campos.estado")}
              </th>
              <th className="px-3 py-2.5 text-left font-medium w-44">
                {tRec("pendientes.columnas.pendientes")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-[200px]">
                <span className="sr-only">{tRec("pendientes.acciones.recibir")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {tRec("avisos.vacioFiltrado")}
                </td>
              </tr>
            ) : null}
            {filtered.map((oc) => {
              const pct =
                oc.totalLineas > 0
                  ? ((oc.totalLineas - oc.pendientesLineas) /
                      oc.totalLineas) *
                    100
                  : 0;
              return (
                <tr
                  key={oc.id}
                  className="border-t border-border transition-colors hover:bg-muted/20"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/compras/oc/${oc.id}`}
                      className="flex flex-col underline-offset-2 hover:underline"
                    >
                      <span className="font-mono text-xs font-medium">
                        {oc.numeroOc}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {format(new Date(oc.fechaEmision), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-sm">{oc.proveedor}</td>
                  <td className="px-3 py-2.5">
                    <EstadoChip estado={oc.estado} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs tabular-nums">
                          {oc.pendientesLineas} pend. / {oc.totalLineas}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct >= 99.99
                              ? "bg-success"
                              : pct > 0
                                ? "bg-brand"
                                : "bg-muted",
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/compras/recepciones/nueva?oc=${oc.id}`}
                          title={tRec("pendientes.acciones.vistaCompleta")}
                          aria-label={tRec("pendientes.acciones.vistaCompleta")}
                        >
                          <Maximize2 className="size-4" />
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
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={activeOc != null}
        onOpenChange={(next) => {
          if (!next) setActiveOcId(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-[min(92vw,1080px)] flex-col gap-0 p-0 sm:max-w-none">
          {activeOc ? (
            <RecibirModalContent
              key={activeOc.id}
              oc={activeOc}
              usuarios={usuarios}
              defaultRecibidoPor={defaultRecibidoPor}
              onClose={() => setActiveOcId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecibirModalContent({
  oc,
  usuarios,
  defaultRecibidoPor,
  onClose,
}: {
  oc: RecepcionPendienteOc;
  usuarios: string[];
  defaultRecibidoPor: string;
  onClose: () => void;
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  const [numeroRemito, setNumeroRemito] = useState("");
  const [fecha, setFecha] = useState<string>(todayISODate);
  const [recibidoPor, setRecibidoPor] = useState(defaultRecibidoPor);
  const [notas, setNotas] = useState("");

  const usuarioOptions = useMemo(() => {
    const names = new Set(usuarios);
    if (defaultRecibidoPor) names.add(defaultRecibidoPor);
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((nombre) => ({ value: nombre, label: nombre }));
  }, [usuarios, defaultRecibidoPor]);
  const [qtyById, setQtyById] = useState<Record<number, number>>(() => {
    const next: Record<number, number> = {};
    for (const l of oc.lineas) next[l.ocDetalleId] = l.pendiente;
    return next;
  });

  const pendientesById = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of oc.lineas) m.set(l.ocDetalleId, l.pendiente);
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
    const next: Record<number, number> = {};
    for (const l of oc.lineas) next[l.ocDetalleId] = l.pendiente;
    setQtyById(next);
  };

  const handleSave = () => {
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

  const lineasConCantidad = Object.values(qtyById).filter((q) => q > 0).length;
  const lineasTotal = oc.lineas.length;

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-4">
        <DialogTitle className="text-base font-semibold">
          {tRec("pendientes.modal.titulo", {
            numero: oc.numeroOc,
            proveedor: oc.proveedor,
          })}
        </DialogTitle>
        <DialogDescription className="text-xs">
          {tRec("pendientes.modal.descripcion")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5 pb-6">
        {/* Metadata block — remito / fecha / recibidoPor */}
        <section className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-remito" className="text-xs font-medium">
                {tRec("campos.remito")} *
              </Label>
              <Input
                id="modal-remito"
                value={numeroRemito}
                onChange={(e) => setNumeroRemito(e.target.value)}
                disabled={isSaving}
                placeholder="R-0001"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-fecha" className="text-xs font-medium">
                {tRec("campos.fecha")}
              </Label>
              <Input
                id="modal-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="modal-recibidoPor"
                className="text-xs font-medium"
              >
                {tRec("campos.recibidoPor")} *
              </Label>
              <Combobox
                value={recibidoPor}
                onChange={setRecibidoPor}
                options={usuarioOptions}
                allowCreate={false}
                disabled={isSaving}
                placeholder={tRec("campos.recibidoPor")}
                className="h-9 w-full"
              />
            </div>
          </div>
        </section>

        {/* Summary strip — running total + Recibir todo */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {tRec("pendientes.modal.ayudaCantidad")}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {lineasConCantidad}/{lineasTotal} líneas ·{" "}
              <span className="font-medium text-foreground">
                {totalRecibir.toLocaleString("es-AR", {
                  maximumFractionDigits: 2,
                })}
              </span>{" "}
              unidades a recibir
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={recibirTodo}
            disabled={isSaving}
          >
            {tRec("acciones.recibirTodo")}
          </Button>
        </div>

        {/* Líneas table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-28 px-3 py-2.5 text-left font-semibold">
                  {tRec("columnas.codigo")}
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  {tRec("columnas.descripcion")}
                </th>
                <th className="w-24 px-3 py-2.5 text-right font-semibold">
                  {tRec("columnas.pendiente")}
                </th>
                <th className="w-36 px-3 py-2.5 text-right font-semibold">
                  {tRec("columnas.recibirAhora")}
                </th>
              </tr>
            </thead>
            <tbody>
              {oc.lineas.map((l, idx) => {
                const qty = qtyById[l.ocDetalleId] ?? 0;
                const over = qty > l.pendiente + 1e-9;
                const filled = qty > 0;
                return (
                  <tr
                    key={l.ocDetalleId}
                    className={cn(
                      idx !== 0 && "border-t border-border",
                      "transition-colors",
                      filled && "bg-success-weak/20",
                    )}
                  >
                    <td className="px-3 py-2.5 align-middle font-mono text-xs">
                      {l.itemCodigo || "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {l.itemDescripcion || "—"}
                        </span>
                        {l.unidadMedida ? (
                          <span className="text-[11px] text-muted-foreground">
                            {l.unidadMedida}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono tabular-nums text-xs text-muted-foreground">
                      {l.pendiente}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <NumberInput
                        min={0}
                        max={l.pendiente}
                        steppers
                        stepAmount={1}
                        value={qty}
                        onChange={(v) =>
                          updateQty(l.ocDetalleId, v === "" ? 0 : v)
                        }
                        disabled={isSaving}
                        aria-invalid={over || undefined}
                        className="ml-auto h-8 w-36"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="modal-notas" className="text-xs font-medium">
            {tRec("resumenSidebar.notas")}
          </Label>
          <Textarea
            id="modal-notas"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={isSaving}
            placeholder={tRec("resumenSidebar.notasPlaceholder")}
          />
        </div>
      </div>

      {/* Pinned footer */}
      <DialogFooter className="mx-0 mb-0 flex-col gap-2 rounded-none border-t border-border bg-transparent px-6 py-3 sm:flex-row sm:justify-between">
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
  );
}
