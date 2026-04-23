import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ClipboardList, Tractor, Wallet } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { InlineState } from "@/components/app/states";
import { ChartCard } from "@/components/stats/chart-card";
import {
  HorizontalBars,
  type HorizontalBarRow,
} from "@/components/stats/horizontal-bars";
import { KpiCard } from "@/components/stats/kpi-card";
import { RangeSelect } from "@/components/stats/range-select";
import { formatCurrencyARS, formatCurrencyShort } from "@/lib/stats/format";

import { computeMaqMetrics } from "./actions";
import { MaquinariaStatsClient } from "./maquinaria-stats-client";
import { MAQ_RANGES, type MaqRange } from "./types";

export const dynamic = "force-dynamic";

export default async function MaquinariaStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("estadisticas");
  const sp = await searchParams;

  const range: MaqRange = (MAQ_RANGES as readonly string[]).includes(
    sp.range ?? "",
  )
    ? (sp.range as MaqRange)
    : "ytd";

  const { rows, sinHistorial, totalMaquinas } =
    await computeMaqMetrics(range);

  const rangoOptions = MAQ_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));

  const costoTotal = rows.reduce((acc, r) => acc + r.costoTotal, 0);
  const conHistorial = totalMaquinas - sinHistorial;

  const topCosto: HorizontalBarRow[] = rows
    .filter((r) => r.costoTotal > 0)
    .slice(0, 8)
    .map((r) => ({
      label: r.nombre,
      value: r.costoTotal,
      tone: "brand",
    }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/estadisticas">
            <ArrowLeft className="size-4" />
            {t("maquinaria.volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("maquinaria.titulo")}
          description={t("maquinaria.descripcion")}
          actions={
            <RangeSelect<MaqRange>
              current={range}
              options={rangoOptions}
              ariaLabel={t("maquinaria.titulo")}
            />
          }
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Tractor}
          label={t("maquinaria.kpi.totales")}
          value={totalMaquinas.toLocaleString("es-AR")}
          caption={t("maquinaria.kpi.totalesCaption")}
          href="/maquinaria"
        />
        <KpiCard
          icon={ClipboardList}
          tone={conHistorial === 0 ? "warn" : "info"}
          label={t("maquinaria.kpi.conHistorial")}
          value={`${conHistorial} / ${totalMaquinas}`}
          caption={t("maquinaria.kpi.conHistorialCaption")}
        />
        <KpiCard
          icon={Wallet}
          label={t("maquinaria.kpi.costoTotal")}
          value={formatCurrencyARS(costoTotal)}
          caption={t("maquinaria.kpi.costoTotalCaption")}
        />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ChartCard
            title={t("maquinaria.topCostoTitulo")}
            subtitle={t("maquinaria.topCostoSubtitulo")}
          >
            {topCosto.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <InlineState>{t("maquinaria.vacio")}</InlineState>
              </div>
            ) : (
              <HorizontalBars
                data={topCosto}
                formatValue={formatCurrencyShort}
              />
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("maquinaria.sinHistorial", { count: sinHistorial })}
            </p>
          </ChartCard>
        </div>

        <div className="lg:col-span-7">
          <ChartCard
            title={t("maquinaria.tablaTitulo")}
            subtitle={t("maquinaria.tablaSubtitulo")}
          >
            <MaquinariaStatsClient rows={rows} />
          </ChartCard>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("maquinaria.totales", { total: totalMaquinas })}
      </p>
    </div>
  );
}
