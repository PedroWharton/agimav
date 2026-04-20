"use client";

import { useMemo, useState } from "react";

import {
  AttachBox,
  type AttachedDraft,
  POStrip,
  ProgressRing,
  QtyStepper,
  ReceiveBulkBar,
  ReceiveTable,
  type ReceiveLine,
} from "@/components/compras/recepcion";

const INITIAL_LINES: ReceiveLine[] = [
  {
    id: 1,
    sku: "FA-15W40-4L",
    nombre: "Filtro aceite motor 15W40",
    pedidos: 10,
    recibidosPrev: 0,
    recibirAhora: 10, // ok
  },
  {
    id: 2,
    sku: "FC-FLEET-5",
    nombre: "Filtro combustible primario Fleet",
    pedidos: 8,
    recibidosPrev: 0,
    recibirAhora: 10, // partial (overage)
  },
  {
    id: 3,
    sku: "AC-15W40-20",
    nombre: "Aceite motor 15W40 x 20 L",
    pedidos: 6,
    recibidosPrev: 0,
    recibirAhora: 4, // short
  },
  {
    id: 4,
    sku: "COR-HID-1/2",
    nombre: "Correa hidraulica 1/2 pulgada",
    pedidos: 4,
    recibidosPrev: 0,
    recibirAhora: 0, // pending
  },
];

export default function RecepcionDemoPage() {
  const [lines, setLines] = useState<ReceiveLine[]>(INITIAL_LINES);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [standaloneQty, setStandaloneQty] = useState(3);
  const [attached, setAttached] = useState<AttachedDraft[]>([]);

  const onLineChange = (id: number, recibirAhora: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, recibirAhora } : l)),
    );
  };

  const onSelectChange = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onReceiveAll = () => {
    setLines((prev) =>
      prev.map((l) =>
        selectedIds.has(l.id)
          ? { ...l, recibirAhora: Math.max(0, l.pedidos - l.recibidosPrev) }
          : l,
      ),
    );
  };

  const onClear = () => setSelectedIds(new Set());

  const totals = useMemo(() => {
    const totalUnidades = lines.reduce((a, l) => a + l.pedidos, 0);
    const unidadesRecibidas = lines.reduce(
      (a, l) => a + l.recibidosPrev + l.recibirAhora,
      0,
    );
    return { totalUnidades, unidadesRecibidas };
  }, [lines]);

  return (
    <div className="flex flex-col gap-8 p-6 pb-32">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Demo · Recepción primitives (R6-01)
        </h1>
        <p className="text-[12.5px] text-muted-foreground">
          Datos sintéticos. Valida los 4 tintes de fila (ok / partial / short /
          pending), el stepper, la barra de selección y el drop zone.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">POStrip</h2>
        <POStrip
          ocNumero="OC-00128"
          proveedor="Repuestos Sur SA"
          fechaEmitida={new Date(2026, 3, 18)}
          totalLineas={lines.length}
          totalUnidades={totals.totalUnidades}
          unidadesRecibidas={totals.unidadesRecibidas}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          ReceiveTable
        </h2>
        <ReceiveTable
          lines={lines}
          onLineChange={onLineChange}
          onSelectChange={onSelectChange}
          selectedIds={selectedIds}
        />
        <p className="text-[11.5px] text-muted-foreground">
          Marcá una o más filas para ver la <code>ReceiveBulkBar</code> flotando
          abajo.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            ProgressRing
          </h2>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <ProgressRing value={0.25} />
            <ProgressRing value={0.6} />
            <ProgressRing value={1} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            QtyStepper (standalone)
          </h2>
          <div className="flex items-center gap-6 rounded-xl border border-border bg-card p-4">
            <QtyStepper
              value={standaloneQty}
              onChange={setStandaloneQty}
              min={0}
              max={20}
              size="md"
            />
            <QtyStepper
              value={standaloneQty}
              onChange={setStandaloneQty}
              min={0}
              max={20}
              size="sm"
            />
            <span className="text-[12.5px] text-muted-foreground">
              valor: <span className="font-mono">{standaloneQty}</span> (0..20)
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">AttachBox</h2>
        <div className="max-w-md">
          <AttachBox
            files={attached}
            onAdd={(drafts) => setAttached((prev) => [...prev, ...drafts])}
            onRemove={(id) =>
              setAttached((prev) => prev.filter((f) => f.id !== id))
            }
          />
        </div>
      </section>

      <ReceiveBulkBar
        selectedCount={selectedIds.size}
        onReceiveAll={onReceiveAll}
        onClear={onClear}
      />
    </div>
  );
}
