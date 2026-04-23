import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Building2, PieChart, Wallet } from "lucide-react";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
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

import { computeProveedoresGasto } from "./actions";
import { PROV_RANGES, type ProvRange } from "./types";
import { ProveedoresExportButton } from "./proveedores-export-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ProveedoresStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session, "estadisticas.proveedores.view")) {
    redirect("/estadisticas");
  }

  const t = await getTranslations("estadisticas");
  const sp = await searchParams;

  const range: ProvRange = (PROV_RANGES as readonly string[]).includes(
    sp.range ?? "",
  )
    ? (sp.range as ProvRange)
    : "ytd";

  const { rows, totalGeneral, proveedoresConFacturas, proveedoresTotales } =
    await computeProveedoresGasto(range);

  const rangoOptions = PROV_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));

  const top5Share =
    totalGeneral > 0
      ? (rows.slice(0, 5).reduce((acc, r) => acc + r.total, 0) / totalGeneral) *
        100
      : 0;

  const top10: HorizontalBarRow[] = rows.slice(0, 10).map((r) => ({
    label: r.nombre,
    value: r.total,
    tone: "brand",
  }));

  const totalFacturasPeriodo = rows.reduce((acc, r) => acc + r.facturas, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/estadisticas">
            <ArrowLeft className="size-4" />
            {t("proveedores.volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("proveedores.titulo")}
          description={t("proveedores.descripcion")}
          actions={
            <div className="flex items-center gap-2">
              <RangeSelect<ProvRange>
                current={range}
                options={rangoOptions}
                ariaLabel={t("proveedores.titulo")}
              />
              <ProveedoresExportButton range={range} />
            </div>
          }
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Wallet}
          label={t("proveedores.kpi.total")}
          value={formatCurrencyARS(totalGeneral)}
          caption={t("proveedores.kpi.totalCaption", {
            count: totalFacturasPeriodo,
          })}
        />
        <KpiCard
          icon={Building2}
          tone="info"
          label={t("proveedores.kpi.proveedores")}
          value={`${proveedoresConFacturas} / ${proveedoresTotales}`}
          caption={t("proveedores.kpi.proveedoresCaption", {
            total: proveedoresTotales,
          })}
        />
        <KpiCard
          icon={PieChart}
          tone={top5Share >= 80 ? "warn" : "neutral"}
          label={t("proveedores.kpi.topShare")}
          value={`${top5Share.toFixed(1)}%`}
          caption={t("proveedores.kpi.topShareCaption")}
        />
      </div>

      {rows.length === 0 ? (
        <ChartCard
          title={t("proveedores.tablaTitulo")}
          subtitle={t("proveedores.tablaSubtitulo")}
        >
          <div className="flex flex-1 items-center justify-center">
            <InlineState>{t("proveedores.vacio")}</InlineState>
          </div>
        </ChartCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ChartCard
              title={t("proveedores.tablaTitulo")}
              subtitle={t("proveedores.tablaSubtitulo")}
            >
              <div className="-mx-5 -mb-5 overflow-hidden border-t border-border">
                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("proveedores.columnas.proveedor")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("proveedores.columnas.facturas")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("proveedores.columnas.total")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("proveedores.columnas.porcentaje")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("proveedores.columnas.ultima")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-t border-border hover:bg-muted/40"
                        >
                          <td className="px-3 py-2 font-medium">{r.nombre}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.facturas}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatCurrencyARS(r.total)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.porcentaje.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatDate(r.ultima)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 text-xs">
                      <tr>
                        <td className="px-3 py-2 font-medium">
                          {t("proveedores.totalGeneral")}
                        </td>
                        <td />
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrencyARS(totalGeneral)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </ChartCard>
          </div>

          <div className="lg:col-span-5">
            <ChartCard
              title={t("proveedores.top")}
              subtitle={t("proveedores.topSubtitulo")}
            >
              <HorizontalBars
                data={top10}
                formatValue={formatCurrencyShort}
                ariaLabel={t("proveedores.top")}
              />
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t("proveedores.resumen", {
                  con: proveedoresConFacturas,
                  total: proveedoresTotales,
                })}
              </p>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
