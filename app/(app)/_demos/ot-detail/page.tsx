"use client";

import { useState } from "react";
import { CheckCircle2, Pause, Pencil } from "lucide-react";

import {
  Checklist,
  FilesGrid,
  KVGrid,
  MantenimientoStatusMeter,
  OtStatusMeter,
  OTHero,
  PartesTable,
  Timeline,
  type AttachedFile,
  type ChecklistItem,
  type ParteRow,
  type TimelineEvent,
} from "@/components/mantenimiento/detail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function DemoSection({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {lead ? (
          <p className="text-[12.5px] text-subtle-foreground">{lead}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Slab({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-subtle-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function OtDetailDemoPage() {
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);

  // Checklist stateful demo
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
    { id: "1", label: "Drenar aceite motor usado", meta: "D. Flores · 08:22", checked: true },
    { id: "2", label: "Reemplazar filtro de aceite", meta: "D. Flores · 08:41", checked: true },
    { id: "3", label: "Cargar aceite motor 15W-40 (18 L)", meta: "D. Flores · 09:03", checked: true },
    { id: "4", label: "Engrase general de articulaciones", meta: "pendiente", checked: false },
    { id: "5", label: "Registrar horómetro de cierre", meta: "pendiente", checked: false },
  ]);

  const partesRows: ParteRow[] = [
    {
      id: "p1",
      tecnicoNombre: "D. Flores",
      fecha: hoursAgo(3),
      horas: 2.05,
      tarea: "Cambio aceite + filtros",
    },
    {
      id: "p2",
      tecnicoNombre: "M. Aguilera",
      fecha: hoursAgo(2),
      horas: 0.75,
      tarea: "Engrase y prueba de presión",
    },
    {
      id: "p3",
      tecnicoNombre: "L. Peralta",
      fecha: minutesAgo(30),
      horas: 1.5,
      tarea: "Inspección y cierre de OT",
    },
  ];

  const timelineEvents: TimelineEvent[] = [
    {
      id: "t1",
      type: "create",
      at: daysAgo(2),
      actor: "L. Peralta",
      payload: (
        <>
          Creó la OT desde la plantilla{" "}
          <span className="rounded bg-muted px-1.5 font-mono text-[11px] text-foreground">
            Prev. 500 hs · CAT 420F
          </span>
          .
        </>
      ),
    },
    {
      id: "t2",
      type: "status",
      at: hoursAgo(5),
      actor: "D. Flores",
      payload: <>Inició la OT · horómetro de inicio 8.412 hs.</>,
    },
    {
      id: "t3",
      type: "note",
      at: hoursAgo(4),
      actor: "D. Flores",
      payload: <>Filtro combustible con rosca 1/4 NPT en lugar de 1/8.</>,
    },
    {
      id: "t4",
      type: "stock",
      at: hoursAgo(3),
      actor: "Sistema",
      payload: (
        <>
          Descontó 3 repuestos del pañol · mov.{" "}
          <span className="rounded bg-muted px-1.5 font-mono text-[11px] text-foreground">
            MOV-2481
          </span>
          .
        </>
      ),
    },
    {
      id: "t5",
      type: "file",
      at: minutesAgo(45),
      actor: "D. Flores",
      payload: (
        <>
          Adjuntó{" "}
          <span className="rounded bg-muted px-1.5 font-mono text-[11px] text-foreground">
            foto-fugas.jpg
          </span>
          .
        </>
      ),
    },
  ];

  const demoFiles: AttachedFile[] = [
    {
      id: "f1",
      name: "foto-fugas.jpg",
      sizeBytes: 1_258_291,
      uploadedAt: minutesAgo(45),
      uploadedBy: "D. Flores",
      url: "#",
    },
    {
      id: "f2",
      name: "horometro-inicio.jpg",
      sizeBytes: 835_000,
      uploadedAt: hoursAgo(5),
      uploadedBy: "D. Flores",
    },
    {
      id: "f3",
      name: "checklist-500hs.pdf",
      sizeBytes: 320_000,
      uploadedAt: daysAgo(2),
      uploadedBy: "L. Peralta",
      url: "#",
    },
    {
      id: "f4",
      name: "reporte-final.xlsx",
      sizeBytes: 45_000,
      uploadedAt: minutesAgo(10),
      uploadedBy: "L. Peralta",
    },
  ];

  const handleToggle = (id: string) =>
    setChecklistItems((items) =>
      items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
    );

  return (
    <div className="flex flex-col gap-10 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Demo · OT detail primitives (R5-03)
        </h1>
        <p className="text-sm text-subtle-foreground">
          Validación visual de las 7 piezas del detalle de OT. Datos sintéticos.
        </p>
      </header>

      <DemoSection title="OTHero" lead="id + tipo + prioridad + estado editable + título + acciones.">
        <div className="flex flex-col gap-4">
          {(["baja", "media", "alta"] as const).map((p) => (
            <OTHero
              key={p}
              id="OT-3271"
              tipo={{ label: "Preventivo", tone: "info" }}
              prioridad={p}
              estado={{
                label: "En Reparación - Chacra",
                onChangeRequest: () => undefined,
              }}
              title="Cambio aceite y filtros — 500 hs"
              subtitle="Retroexcavadora CAT 420F · Obra Vaca Muerta – Loma Campana"
              actions={
                <>
                  <Button variant="outline" size="sm">
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Pause aria-hidden />
                    Pausar
                  </Button>
                  <Button size="sm">
                    <CheckCircle2 aria-hidden />
                    Marcar completada
                  </Button>
                </>
              }
            />
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="StatusMeter presets"
        lead="MantenimientoStatusMeter (3 pasos) · OtStatusMeter (2 pasos)."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Slab label="MANT · Pendiente">
            <MantenimientoStatusMeter estado="Pendiente" />
          </Slab>
          <Slab label="MANT · En Reparación - Chacra">
            <MantenimientoStatusMeter
              estado="En Reparación - Chacra"
              reparacionEn="Chacra"
            />
          </Slab>
          <Slab label="MANT · En Reparación - Taller">
            <MantenimientoStatusMeter
              estado="En Reparación - Taller"
              reparacionEn="Taller"
            />
          </Slab>
          <Slab label="MANT · Finalizado">
            <MantenimientoStatusMeter
              estado="Finalizado"
              reparacionEn="Taller"
            />
          </Slab>
          <Slab label="MANT · Cancelado">
            <MantenimientoStatusMeter estado="Cancelado" />
          </Slab>
          <Slab label="OT · En Curso">
            <OtStatusMeter estado="En Curso" />
          </Slab>
          <Slab label="OT · Cerrada">
            <OtStatusMeter estado="Cerrada" />
          </Slab>
          <Slab label="OT · Cancelada">
            <OtStatusMeter estado="Cancelada" />
          </Slab>
        </div>
      </DemoSection>

      <DemoSection title="KVGrid" lead="4 columnas · label uppercase + value.">
        <Card className="p-5">
          <KVGrid
            items={[
              { label: "Máquina", value: "CAT 420F · MAQ-042" },
              { label: "Horómetro al inicio", value: "8.412 hs" },
              { label: "Obra", value: "Vaca Muerta – Loma Campana" },
              { label: "Técnico asignado", value: "D. Flores" },
              { label: "Fecha programada", value: "22/04/2026 · 08:00" },
              { label: "Duración estimada", value: "" },
              { label: "Plantilla aplicada", value: "Prev. 500 hs · CAT 420F" },
              { label: "Operador", value: "J. Mansilla" },
            ]}
          />
        </Card>
      </DemoSection>

      <DemoSection title="Checklist" lead="Toggleable · progreso al pie.">
        <Card className="p-5">
          <Checklist items={checklistItems} onToggle={handleToggle} />
        </Card>
      </DemoSection>

      <DemoSection title="PartesTable" lead="Técnico, fecha, horas, tarea + total horas.">
        <Card className="gap-0 p-0">
          <PartesTable rows={partesRows} />
        </Card>
      </DemoSection>

      <DemoSection title="Timeline" lead="5 tipos de eventos con dots coloreados.">
        <Card className="p-5">
          <Timeline events={timelineEvents} />
        </Card>
      </DemoSection>

      <DemoSection title="FilesGrid" lead="Estado vacío + estado poblado.">
        <div className="flex flex-col gap-4">
          <Slab label="Vacío (v1 typical)">
            <FilesGrid files={[]} />
          </Slab>
          <Slab label="Con archivos">
            <FilesGrid files={demoFiles} />
          </Slab>
        </div>
      </DemoSection>
    </div>
  );
}
