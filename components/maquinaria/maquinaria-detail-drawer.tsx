"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/app/detail-drawer";
import { EmptyState } from "@/components/app/states";
import { StatusChip } from "@/components/app/status-chip";
import { MantEstadoChip } from "@/components/mantenimiento/estado-chip";
import { KVGrid, type KVPair } from "@/components/mantenimiento/detail/kv-grid";
import { cn } from "@/lib/utils";

import { statusChip, EquipIcon } from "./helpers";

export type MaquinariaDetailSection = {
  title: string;
  items: KVPair[];
};

export type MaquinariaDetailData = {
  id: number;
  title: string;
  codigo?: string | null;
  tipoNombre: string;
  estado: string;
  horasAcumuladas: number;
  unidadAbrev?: string | null;
  createdAt?: string | null;
  sections: MaquinariaDetailSection[];
};

export type MantenimientoHistoryRow = {
  id: number;
  tipo: string;
  estado: string;
  descripcion: string | null;
  fechaCreacion: string;
  fechaFinalizacion: string | null;
  responsable: string;
};

export function MaquinariaDetailDrawer({
  open,
  onOpenChange,
  data,
  mantenimientos,
  mantenimientosLoading,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MaquinariaDetailData | null;
  mantenimientos?: MantenimientoHistoryRow[] | null;
  mantenimientosLoading?: boolean;
  footer?: ReactNode;
}) {
  const t = useTranslations("maquinaria.detalle");

  if (!data) {
    return (
      <DetailDrawer
        open={open}
        onOpenChange={onOpenChange}
        title=""
        width="lg"
      />
    );
  }

  const chip = statusChip(data.estado);
  const titleMatchesCodigo =
    data.codigo != null && data.codigo.trim() === data.title.trim();
  const showCodigoInSubtitle = data.codigo && !titleMatchesCodigo;

  const title = (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
      >
        <EquipIcon tipo={data.tipoNombre} className="size-5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{data.title}</span>
    </span>
  );

  const subtitleParts: ReactNode[] = [
    <span key="tipo">{data.tipoNombre}</span>,
  ];
  if (showCodigoInSubtitle) {
    subtitleParts.push(
      <span key="codigo" className="font-mono text-foreground">
        {data.codigo}
      </span>,
    );
  }
  subtitleParts.push(
    <StatusChip key="estado" tone={chip.tone} dot label={chip.label} />,
  );

  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {subtitleParts.map((node, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden className="text-subtle-foreground">
              ·
            </span>
          ) : null}
          {node}
        </span>
      ))}
    </span>
  );

  const unit = data.unidadAbrev?.trim() || "hs";
  const horas = Number.isFinite(data.horasAcumuladas)
    ? data.horasAcumuladas
    : 0;

  const populatedSections = data.sections.filter((s) => s.items.length > 0);

  const resumenContent = (
    <div className="flex flex-col gap-5">
      {/* Hero stat — horómetro */}
      <section className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">
          {t("hero.horometro")}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-heading text-3xl font-semibold tabular-nums leading-none text-foreground">
            {horas.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm font-medium text-subtle-foreground">
            {unit}
          </span>
        </div>
      </section>

      {populatedSections.length > 0 ? (
        <div className="flex flex-col gap-5">
          {populatedSections.map((s, i) => (
            <section key={`${s.title}-${i}`} className="flex flex-col gap-2">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">
                {s.title}
              </h3>
              <KVGrid items={s.items} columns={2} />
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-subtle-foreground">{t("sinAtributos")}</p>
      )}

      {data.createdAt ? (
        <p className="border-t border-border pt-3 text-xs text-subtle-foreground">
          {t("altaEl", { fecha: data.createdAt })}
        </p>
      ) : null}
    </div>
  );

  const mantenimientosContent = (
    <MantenimientosPanel
      maquinariaId={data.id}
      rows={mantenimientos ?? null}
      loading={Boolean(mantenimientosLoading)}
    />
  );

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      width="lg"
      footer={footer}
      tabs={[
        { id: "resumen", label: t("tabs.resumen"), content: resumenContent },
        {
          id: "mantenimientos",
          label: t("tabs.mantenimientos"),
          content: mantenimientosContent,
        },
      ]}
    />
  );
}

function MantenimientosPanel({
  maquinariaId,
  rows,
  loading,
}: {
  maquinariaId: number;
  rows: MantenimientoHistoryRow[] | null;
  loading: boolean;
}) {
  const t = useTranslations("maquinaria.detalle.mantenimientos");
  const tTipos = useTranslations("mantenimiento.tipos");

  const count = rows?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">{t("titulo")}</h3>
          <span className="text-xs text-subtle-foreground">
            {loading
              ? t("cargando")
              : t("resumen", { count })}
          </span>
        </div>
        <Button asChild size="sm">
          <Link href={`/mantenimiento/nuevo?maquinariaId=${maquinariaId}`}>
            <Plus className="size-4" />
            {t("iniciar")}
          </Link>
        </Button>
      </div>

      {loading && rows == null ? (
        <div className="rounded-lg border border-border p-4 text-sm text-subtle-foreground">
          {t("cargando")}
        </div>
      ) : count === 0 ? (
        <EmptyState
          variant="empty-tab"
          title={t("vacio.titulo")}
          description={t("vacio.descripcion")}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {rows!.map((m) => {
            const tipoKey =
              m.tipo === "correctivo" || m.tipo === "preventivo"
                ? (m.tipo as "correctivo" | "preventivo")
                : null;
            const tipoLabel = tipoKey ? tTipos(tipoKey) : m.tipo;
            return (
              <li key={m.id}>
                <Link
                  href={`/mantenimiento/${m.id}`}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 transition-colors",
                    "hover:bg-muted/40 focus-visible:bg-muted/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Wrench className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11.5px] text-muted-foreground">
                        #{m.id}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {tipoLabel}
                      </span>
                      <MantEstadoChip estado={m.estado} />
                    </div>
                    <p className="line-clamp-2 text-sm text-foreground">
                      {m.descripcion?.trim() || t("sinDescripcion")}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtle-foreground">
                      <span>
                        {format(new Date(m.fechaCreacion), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{m.responsable}</span>
                      {m.fechaFinalizacion ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {t("cerradoEl", {
                              fecha: format(
                                new Date(m.fechaFinalizacion),
                                "dd/MM/yyyy",
                                { locale: es },
                              ),
                            })}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
