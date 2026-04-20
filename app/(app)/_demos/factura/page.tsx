"use client";

import { useMemo, useState } from "react";

import {
  FacturaLinesTable,
  InvoiceHeader,
  IvaPicker,
  MatchBanner,
  OcLinkChip,
  TotalsSidebar,
  type FacturaLine,
  type FacturaTipo,
} from "@/components/compras/factura";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

const INITIAL_LINES: FacturaLine[] = [
  {
    id: randomId(),
    ocDetalleId: 1011,
    ocNumero: "OC-1024",
    sku: "FA-15W40-4L",
    nombre: "Filtro aceite motor 15W40",
    cantidad: 10,
    precioUnitario: 48500,
    iva: 21,
    ocPrecioUnitario: 48500,
    ocCantidad: 10,
  },
  {
    id: randomId(),
    ocDetalleId: 1012,
    ocNumero: "OC-1024",
    sku: "FC-FLEET-5",
    nombre: "Filtro combustible primario Fleet",
    cantidad: 6,
    precioUnitario: 27500,
    iva: 21,
    ocPrecioUnitario: 26800,
    ocCantidad: 8,
  },
  {
    id: randomId(),
    ocDetalleId: null,
    sku: "AC-15W40-20",
    nombre: "Aceite motor 15W40 × 20 L (compra suelta)",
    cantidad: 2,
    precioUnitario: 184000,
    iva: 21,
  },
];

export default function FacturaPrimitivesDemoPage() {
  const [tipo, setTipo] = useState<FacturaTipo>("A");
  const [puntoDeVenta, setPuntoDeVenta] = useState("0008");
  const [numero, setNumero] = useState("00041237");
  const [fecha, setFecha] = useState("2026-04-20");
  const [lines, setLines] = useState<FacturaLine[]>(INITIAL_LINES);
  const [ivaStandalone, setIvaStandalone] = useState<number>(21);

  const proveedor = useMemo(() => ({ id: 42, nombre: "Repuestos Sur SA" }), []);

  const subtotalNeto = useMemo(
    () => lines.reduce((sum, l) => sum + l.cantidad * l.precioUnitario, 0),
    [lines],
  );

  const ivaPorAlicuota = useMemo(() => {
    const map: Record<number, number> = { 0: 0, 10.5: 0, 21: 0, 27: 0 };
    for (const line of lines) {
      const base = line.cantidad * line.precioUnitario;
      const rate = line.iva;
      map[rate] = (map[rate] ?? 0) + (base * rate) / 100;
    }
    return map;
  }, [lines]);

  const ivaTotal = useMemo(
    () => Object.values(ivaPorAlicuota).reduce((a, b) => a + b, 0),
    [ivaPorAlicuota],
  );

  const total = subtotalNeto + ivaTotal;

  // Synthetic OC total picked so the demo clearly shows a mismatch on the
  // "match" MatchBanner story as well.
  const ocTotalForSidebar = 2_382_600;

  const onChange = (id: string, patch: Partial<FacturaLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  };
  const onAdd = () => {
    setLines((prev) => [
      ...prev,
      {
        id: randomId(),
        ocDetalleId: null,
        sku: "",
        nombre: "Nuevo ítem",
        cantidad: 1,
        precioUnitario: 0,
        iva: 21,
      },
    ]);
  };
  const onRemove = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Factura primitives — demo
        </h1>
        <p className="text-[13px] text-muted-foreground">
          R6-03 · Synthetic data. Not wired to Prisma.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          InvoiceHeader
        </h2>
        <InvoiceHeader
          tipo={tipo}
          onTipoChange={setTipo}
          puntoDeVenta={puntoDeVenta}
          onPuntoDeVentaChange={setPuntoDeVenta}
          numero={numero}
          onNumeroChange={setNumero}
          fecha={fecha}
          onFechaChange={setFecha}
          proveedor={proveedor}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          MatchBanner — 3 estados
        </h2>
        <MatchBanner
          status="match"
          ocNumero="OC-1024"
          ocTotal={2_382_600}
          facturaTotal={2_382_600}
        />
        <MatchBanner
          status="mismatch"
          ocNumero="OC-1024"
          ocTotal={2_382_600}
          facturaTotal={total}
        />
        <MatchBanner status="no-oc" facturaTotal={total} />
      </section>

      <section className="grid grid-cols-[1fr_320px] items-start gap-5">
        <div className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            FacturaLinesTable (con diff highlighting)
          </h2>
          <FacturaLinesTable
            lines={lines}
            onChange={onChange}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            TotalsSidebar
          </h2>
          <TotalsSidebar
            subtotalNeto={subtotalNeto}
            ivaPorAlicuota={ivaPorAlicuota}
            total={total}
            ocTotal={ocTotalForSidebar}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          IvaPicker + OcLinkChip (standalone)
        </h2>
        <div className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <IvaPicker value={ivaStandalone} onChange={setIvaStandalone} />
          <span className="font-mono text-[12px] text-muted-foreground">
            valor actual: {ivaStandalone}
          </span>
          <OcLinkChip ocNumero="OC-1024" ocDetalleId={1011} />
        </div>
      </section>
    </main>
  );
}
