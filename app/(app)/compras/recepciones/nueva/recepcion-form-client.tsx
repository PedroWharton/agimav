"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { PageHeader } from "@/components/app/page-header";
import {
  AttachBox,
  POStrip,
  ProgressRing,
  ReceiveBulkBar,
  ReceiveTable,
  type AttachedDraft,
  type ReceiveLine,
} from "@/components/compras/recepcion";

import { createRecepcion } from "../actions";

export type RecepcionFormLinea = {
  id: number;
  orden: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadMedida: string | null;
  cantidadSolicitada: number;
  cantidadRecibida: number;
  precioUnitario: number;
};

export type RecepcionFormOc = {
  id: number;
  numeroOc: string;
  proveedor: string;
  /** ISO string; server converts Date before passing. */
  fechaEmision: string;
};

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RecepcionFormClient({
  oc,
  lineas: initialLineas,
  defaultRecibidoPor,
}: {
  oc: RecepcionFormOc;
  lineas: RecepcionFormLinea[];
  defaultRecibidoPor: string;
}) {
  const tRec = useTranslations("compras.recepciones");
  const tCommon = useTranslations("listados.common");
  const router = useRouter();

  const [numeroRemito, setNumeroRemito] = useState("");
  const [fecha, setFecha] = useState<string>(todayISODate());
  const [recibidoPor, setRecibidoPor] = useState(defaultRecibidoPor);
  const [notas, setNotas] = useState("");
  const [files, setFiles] = useState<AttachedDraft[]>([]);

  // `recibirAhora` per-line (number) in state. Destino + observaciones per line
  // are retained to keep the existing transactional payload intact.
  const [lineState, setLineState] = useState(() =>
    initialLineas.map((l) => ({
      id: l.id,
      recibirAhora: 0,
      destino: "Stock" as "Stock" | "Directa",
      observaciones: "",
    })),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSaving, startSave] = useTransition();

  const pendientesById = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of initialLineas) {
      m.set(l.id, Math.max(0, l.cantidadSolicitada - l.cantidadRecibida));
    }
    return m;
  }, [initialLineas]);

  const receiveLines: ReceiveLine[] = useMemo(() => {
    return initialLineas.map((l) => {
      const st = lineState.find((s) => s.id === l.id);
      return {
        id: l.id,
        sku: l.itemCodigo || `#${l.orden}`,
        nombre: l.itemDescripcion || "—",
        pedidos: l.cantidadSolicitada,
        recibidosPrev: l.cantidadRecibida,
        recibirAhora: st?.recibirAhora ?? 0,
      };
    });
  }, [initialLineas, lineState]);

  const totalLineas = initialLineas.length;
  const totalPedidos = initialLineas.reduce(
    (a, l) => a + l.cantidadSolicitada,
    0,
  );
  const totalRecibidosPrev = initialLineas.reduce(
    (a, l) => a + l.cantidadRecibida,
    0,
  );
  const totalRecibirAhora = lineState.reduce((a, l) => a + l.recibirAhora, 0);
  const totalTrasRecepcion = totalRecibidosPrev + totalRecibirAhora;
  const progressValue =
    totalPedidos > 0 ? totalTrasRecepcion / totalPedidos : 0;

  const overReception = lineState.some((l) => {
    const pendiente = pendientesById.get(l.id) ?? 0;
    return l.recibirAhora > pendiente + 1e-9;
  });

  const activeRows = lineState.filter((l) => l.recibirAhora > 0);

  const canSave =
    !isSaving &&
    numeroRemito.trim().length > 0 &&
    recibidoPor.trim().length > 0 &&
    activeRows.length > 0 &&
    !overReception;

  const handleLineChange = (id: number, recibirAhora: number) => {
    const pendiente = pendientesById.get(id) ?? 0;
    const clamped = Math.max(0, Math.min(recibirAhora, pendiente));
    setLineState((prev) =>
      prev.map((l) => (l.id === id ? { ...l, recibirAhora: clamped } : l)),
    );
  };

  const handleSelectChange = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleReceiveAllSelected = () => {
    setLineState((prev) =>
      prev.map((l) => {
        if (!selectedIds.has(l.id)) return l;
        const pendiente = pendientesById.get(l.id) ?? 0;
        return { ...l, recibirAhora: Math.max(0, pendiente) };
      }),
    );
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleAddFiles = (incoming: AttachedDraft[]) => {
    setFiles((prev) => [...prev, ...incoming]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  function handleSave() {
    startSave(async () => {
      const payload = {
        ocId: oc.id,
        numeroRemito: numeroRemito.trim(),
        fechaRecepcion: new Date(fecha),
        recibidoPor: recibidoPor.trim(),
        observaciones: notas.trim() || null,
        lineas: lineState
          .filter((l) => l.recibirAhora > 0)
          .map((l) => ({
            ocDetalleId: l.id,
            cantidadRecibidaAhora: l.recibirAhora,
            destino: l.destino,
            observaciones: l.observaciones.trim() || null,
          })),
      };
      const result = await createRecepcion(payload);
      if (result.ok) {
        toast.success(tRec("avisos.creadaExitoso", { id: result.id }));
        router.push(`/compras/recepciones/${result.id}`);
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
  }

  const fechaEmision = useMemo(
    () => new Date(oc.fechaEmision),
    [oc.fechaEmision],
  );

  return (
    <div className="flex flex-col gap-5 p-6 pb-28">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/compras/oc/${oc.id}`}>
            <ArrowLeft className="size-4" />
            {oc.numeroOc}
          </Link>
        </Button>
        <PageHeader
          title={tRec("nuevaTitulo", {
            numero: oc.numeroOc,
            proveedor: oc.proveedor,
          })}
          description={tRec("nuevaDescripcion")}
        />
      </div>

      <div className="sticky top-0 z-10 bg-background/80 pt-2 pb-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <POStrip
          ocNumero={oc.numeroOc}
          proveedor={oc.proveedor}
          fechaEmitida={fechaEmision}
          totalLineas={totalLineas}
          totalUnidades={totalPedidos}
          unidadesRecibidas={totalTrasRecepcion}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: doc header + receive table */}
        <div className="flex flex-col gap-4">
          <Card size="sm" className="px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="numeroRemito">
                  {tRec("campos.remito")}
                </Label>
                <Input
                  id="numeroRemito"
                  value={numeroRemito}
                  onChange={(e) => setNumeroRemito(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="fechaRecepcion">
                  {tRec("campos.fecha")}
                </Label>
                <Input
                  id="fechaRecepcion"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="recibidoPor">
                  {tRec("campos.recibidoPor")}
                </Label>
                <Input
                  id="recibidoPor"
                  value={recibidoPor}
                  onChange={(e) => setRecibidoPor(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </Card>

          <ReceiveTable
            lines={receiveLines}
            onLineChange={handleLineChange}
            onSelectChange={handleSelectChange}
            selectedIds={selectedIds}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
          <Card size="sm" className="px-4 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {tRec("resumenSidebar.titulo")}
            </h3>
            <div className="flex items-center gap-4">
              <ProgressRing value={progressValue} size={64} strokeWidth={6} />
              <div className="flex flex-1 flex-col gap-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {tRec("resumenSidebar.lineas")}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {totalLineas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {tRec("resumenSidebar.unidadesPedidas")}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {totalPedidos}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {tRec("resumenSidebar.unidadesRecibidas")}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {totalRecibirAhora}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card size="sm" className="px-4 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {tRec("resumenSidebar.notas")}
            </h3>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              disabled={isSaving}
              placeholder={tRec("resumenSidebar.notasPlaceholder")}
            />
          </Card>

          <Card size="sm" className="px-4 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {tRec("resumenSidebar.adjuntos")}
            </h3>
            <AttachBox
              files={files}
              onAdd={handleAddFiles}
              onRemove={handleRemoveFile}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {tRec("resumenSidebar.adjuntosNota")}
            </p>
          </Card>
        </aside>
      </div>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            disabled={isSaving}
          >
            <Link href={`/compras/oc/${oc.id}`}>
              {tRec("footer.cancelar")}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? tRec("footer.guardando") : tRec("footer.confirmar")}
          </Button>
        </div>
      </div>

      {/* Bulk bar — visible when rows are selected */}
      <ReceiveBulkBar
        selectedCount={selectedIds.size}
        onReceiveAll={handleReceiveAllSelected}
        onClear={handleClearSelection}
      />
    </div>
  );
}
