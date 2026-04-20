import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Activity, DollarSign, ListOrdered } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { InlineState } from "@/components/app/states";
import { ChartCard } from "@/components/stats/chart-card";
import { KpiCard } from "@/components/stats/kpi-card";
import { PriceChart } from "@/components/stats/price-chart";
import { RangeSelect } from "@/components/stats/range-select";

import { getPriceSeries } from "./actions";
import { PRECIOS_RANGES, type PreciosRange } from "./types";
import { ItemPicker, type ItemOption } from "./item-picker";

export const dynamic = "force-dynamic";

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function loadItemOptions(): Promise<ItemOption[]> {
  const grouped = await prisma.precioHistorico.groupBy({
    by: ["itemId"],
    _count: { _all: true },
    _max: { fecha: true },
    where: { precioArs: { gt: 0 } },
    orderBy: { _max: { fecha: "desc" } },
  });

  if (grouped.length === 0) return [];

  const itemIds = grouped.map((g) => g.itemId);
  const items = await prisma.inventario.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, codigo: true, descripcion: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  return grouped
    .map((g) => {
      const item = byId.get(g.itemId);
      if (!item) return null;
      return {
        id: item.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        graficable: g._count._all >= 2,
      };
    })
    .filter((v): v is ItemOption => v !== null)
    .sort((a, b) => {
      if (a.graficable !== b.graficable) return a.graficable ? -1 : 1;
      return (a.descripcion ?? "").localeCompare(b.descripcion ?? "");
    });
}

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; range?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("estadisticas");
  const sp = await searchParams;

  const range: PreciosRange = (PRECIOS_RANGES as readonly string[]).includes(
    sp.range ?? "",
  )
    ? (sp.range as PreciosRange)
    : "todo";
  const itemIdParam = sp.itemId ? Number.parseInt(sp.itemId, 10) : null;
  const itemId = itemIdParam && Number.isFinite(itemIdParam) ? itemIdParam : null;

  const options = await loadItemOptions();
  const effectiveItemId =
    itemId ?? options.find((o) => o.graficable)?.id ?? options[0]?.id ?? null;

  const series = effectiveItemId
    ? await getPriceSeries(effectiveItemId, range)
    : null;

  const rangoOptions = PRECIOS_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));

  const first = series?.points[0] ?? null;
  const last =
    series && series.points.length > 0
      ? series.points[series.points.length - 1]!
      : null;
  const variacion =
    first && last && first.precioArs > 0
      ? ((last.precioArs - first.precioArs) / first.precioArs) * 100
      : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/estadisticas">
            <ArrowLeft className="size-4" />
            {t("precios.volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("precios.titulo")}
          description={t("precios.descripcion")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ItemPicker current={effectiveItemId} items={options} />
              <RangeSelect<PreciosRange>
                current={range}
                options={rangoOptions}
                ariaLabel={t("precios.titulo")}
              />
            </div>
          }
        />
      </div>

      {options.length === 0 ? (
        <ChartCard
          title={t("precios.chartTitulo")}
          subtitle={t("precios.chartSubtitulo")}
        >
          <div className="flex flex-1 items-center justify-center">
            <InlineState>{t("precios.sinHistorial")}</InlineState>
          </div>
        </ChartCard>
      ) : !series ? (
        <ChartCard
          title={t("precios.chartTitulo")}
          subtitle={t("precios.chartSubtitulo")}
        >
          <div className="flex flex-1 items-center justify-center">
            <InlineState>{t("precios.elegirItem")}</InlineState>
          </div>
        </ChartCard>
      ) : (
        <>
          {/* Item identity */}
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{series.codigo ?? "—"}</div>
              <div className="text-sm text-muted-foreground">
                {series.descripcion ?? "—"}
                {series.unidadMedida ? ` · ${series.unidadMedida}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="h-0.5 w-4"
                  style={{ backgroundColor: "var(--brand)" }}
                />
                ARS
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="h-0 w-4 border-t border-dashed"
                  style={{ borderColor: "var(--warn)" }}
                />
                USD
              </span>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              icon={ListOrdered}
              tone="info"
              label={t("precios.kpi.registros")}
              value={series.points.length.toLocaleString("es-AR")}
              caption={t("precios.kpi.registrosCaption", {
                count: series.points.length,
              })}
            />
            <KpiCard
              icon={DollarSign}
              label={t("precios.kpi.ultimoArs")}
              value={last ? formatCurrencyARS(last.precioArs) : "—"}
              caption={
                last
                  ? t("precios.kpi.ultimoArsCaption", {
                      fecha: last.fecha,
                    })
                  : ""
              }
            />
            <KpiCard
              icon={Activity}
              tone={
                variacion === null
                  ? "neutral"
                  : variacion > 10
                    ? "warn"
                    : variacion < -5
                      ? "ok"
                      : "neutral"
              }
              label={t("precios.kpi.variacion")}
              value={variacion !== null ? formatPercent(variacion) : "—"}
              caption={t("precios.kpi.variacionCaption")}
            />
          </div>

          {series.points.length < 2 ? (
            <ChartCard
              title={t("precios.chartTitulo")}
              subtitle={t("precios.chartSubtitulo")}
            >
              <div className="flex flex-1 items-center justify-center">
                <InlineState>{t("precios.unSoloPunto")}</InlineState>
              </div>
            </ChartCard>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <ChartCard
                title={t("precios.chartTitulo")}
                subtitle={t("precios.chartSubtitulo")}
              >
                <div className="overflow-x-auto">
                  <PriceChart
                    points={series.points}
                    dolarFrom={series.dolarFrom}
                    width={720}
                    height={280}
                  />
                </div>
              </ChartCard>

              <ChartCard
                title={t("precios.tablaTitulo")}
                subtitle={t("precios.tablaSubtitulo")}
              >
                <div className="-mx-5 -mb-5 overflow-hidden border-t border-border">
                  <div className="max-h-[400px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("precios.columnas.fecha")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            {t("precios.columnas.ars")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            {t("precios.columnas.usd")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("precios.columnas.proveedor")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.points.map((p, i) => (
                          <tr
                            key={`${p.fecha}-${i}`}
                            className="border-t border-border hover:bg-muted/40"
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              {p.fecha}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrencyARS(p.precioArs)}
                            </td>
                            <td
                              className="px-3 py-2 text-right tabular-nums"
                              style={{ color: "var(--warn)" }}
                            >
                              {p.precioUsd !== null
                                ? `US$ ${p.precioUsd.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {p.proveedor ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
