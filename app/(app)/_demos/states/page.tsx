import { Plus, RotateCcw } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  InlineError,
  InlineState,
  Skeleton,
} from "@/components/app/states";
import { Button } from "@/components/ui/button";

function SectionHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {lead ? (
        <p className="max-w-[520px] text-right text-[12.5px] leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function DocCard({
  label,
  usage,
  children,
}: {
  label: string;
  usage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        {usage ? <span className="font-medium text-foreground">{usage}</span> : null}
      </div>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}

function SkRow() {
  return (
    <div className="grid grid-cols-[36px_1fr_1fr_100px_80px] items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
      <Skeleton.Avatar className="rounded-md" />
      <div className="flex flex-col gap-1.5">
        <Skeleton.Text line={80} />
        <Skeleton.Text line={60} className="h-[9px]" />
      </div>
      <Skeleton.Text line={60} />
      <Skeleton.Text line={80} />
      <Skeleton.Chip />
    </div>
  );
}

export default function StatesDemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Estados compartidos</h1>
        <p className="text-sm text-muted-foreground">
          Demo route for the shared states set (R2-05). Not shipped as a user-facing route;
          lives here so typecheck + lint validate every variant.
        </p>
      </header>

      {/* =============== EMPTY STATES =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="Empty states"
          lead='Cuando una tabla o panel no tiene registros todavía. Tres variantes: "no-results" (filtro lo vació), "no-data" (data vacía de arranque), "empty-tab" (sub-sección sin registros).'
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DocCard label='EmptyState · variant="no-results"' usage="tras filtro / búsqueda">
            <EmptyState
              variant="no-results"
              description={
                <>
                  No encontramos proveedores que coincidan con <strong>&ldquo;hidro&rdquo;</strong>{" "}
                  y estado <strong>inactivo</strong>. Probá quitar algún filtro o ajustar la
                  búsqueda.
                </>
              }
              actions={
                <Button variant="outline" size="sm">
                  Limpiar filtros
                </Button>
              }
            />
          </DocCard>

          <DocCard label='EmptyState · variant="no-data"' usage="primera vez">
            <EmptyState
              variant="no-data"
              title="Todavía no hay ítems en inventario"
              description="Cuando tu equipo empiece a cargar repuestos, aparecerán acá. Podés importar desde un CSV o crearlos manualmente."
              actions={
                <>
                  <Button variant="outline" size="sm">
                    Importar CSV
                  </Button>
                  <Button size="sm">
                    <Plus />
                    Crear primer ítem
                  </Button>
                </>
              }
            />
          </DocCard>

          <DocCard label='EmptyState · variant="empty-tab"' usage="tab / sub-sección vacía">
            <EmptyState
              variant="empty-tab"
              title="Sin partes de trabajo cargados"
              description='Los técnicos todavía no cargaron horas para esta OT. Se registran al tocar "Cargar parte".'
              actions={
                <Button size="sm">
                  <Plus />
                  Cargar parte
                </Button>
              }
            />
          </DocCard>

          <DocCard label="InlineState" usage="zonas pequeñas">
            <InlineState mark="— · sin datos · —">
              Usar en celdas o bloques chicos donde no vale la pena un ícono. Ej: &ldquo;Sin
              facturas asociadas&rdquo;.
            </InlineState>
          </DocCard>
        </div>
      </section>

      {/* =============== SKELETONS =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="Loading · skeletons"
          lead="Placeholders animados que replican la estructura del contenido final. Evitan layout shift y dan sensación de velocidad."
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DocCard label="Skeleton primitives" usage="Text / Title / Chip / Avatar / Box">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Skeleton.Avatar />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton.Title />
                  <Skeleton.Text line={60} />
                </div>
                <Skeleton.Chip />
              </div>
              <Skeleton.Text line={100} />
              <Skeleton.Text line={80} />
              <Skeleton.Text line={60} />
              <Skeleton.Text line={40} />
              <Skeleton.Box />
            </div>
          </DocCard>

          <DocCard label="Skeleton · TableRows rows={5}" usage="listas (inventario, compras)">
            <div className="-mx-6 -my-6">
              {Array.from({ length: 5 }, (_, i) => (
                <SkRow key={i} />
              ))}
            </div>
          </DocCard>

          <DocCard label="Skeleton · CardGrid cards={4}" usage="grilla maquinaria">
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[10px] border border-border bg-card"
                >
                  <Skeleton.Box className="aspect-video h-auto rounded-none" />
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton.Title className="w-[80%]" />
                    <Skeleton.Text line={60} />
                    <Skeleton.Text line={100} />
                  </div>
                </div>
              ))}
            </div>
          </DocCard>

          <DocCard label="Skeleton · KPIStrip" usage="dashboards, headers">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3.5"
                >
                  <Skeleton.Text line={60} className="h-2.5" />
                  <Skeleton.Title line={40} className="h-[22px]" />
                  <Skeleton.Text line={80} className="h-2.5" />
                </div>
              ))}
            </div>
          </DocCard>
        </div>
      </section>

      {/* =============== ERROR STATES =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="Error states"
          lead="Tres severidades: error del servidor (recuperable), permiso denegado, y fallo de red. Siempre mostrar acción primaria para salir del estado."
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DocCard label='ErrorState · variant="server"' usage="500s, timeouts">
            <ErrorState
              variant="server"
              title="No pudimos cargar los proveedores"
              description="Hubo un problema del lado del servidor. Intentá de nuevo en unos segundos. Si el problema persiste, avisale al administrador."
              trace="GET /api/proveedores — 500 Internal Server Error · trace-id: 7f3a2b"
              actions={
                <>
                  <Button variant="outline" size="sm">
                    <RotateCcw />
                    Reintentar
                  </Button>
                  <Button variant="outline" size="sm">
                    Reportar
                  </Button>
                </>
              }
            />
          </DocCard>

          <DocCard label='ErrorState · variant="forbidden"' usage="403 / permisos">
            <ErrorState
              variant="forbidden"
              description={
                <>
                  Esta sección requiere el rol <strong>Administrador</strong> o{" "}
                  <strong>Compras</strong>. Si creés que deberías tener acceso, contactá a un
                  administrador.
                </>
              }
              actions={
                <Button variant="outline" size="sm">
                  Volver al inicio
                </Button>
              }
            />
          </DocCard>

          <DocCard label='ErrorState · variant="offline"' usage="sin conexión">
            <ErrorState
              variant="offline"
              actions={
                <Button variant="outline" size="sm">
                  <RotateCcw />
                  Reintentar
                </Button>
              }
            />
          </DocCard>

          <DocCard label="InlineError" usage="fallas parciales de panel">
            <InlineError
              message="No se pudo cargar la bitácora"
              description="El resto de la OT se muestra normal."
              action={
                <Button size="sm" variant="outline">
                  Reintentar
                </Button>
              }
            />
          </DocCard>
        </div>
      </section>
    </div>
  );
}
