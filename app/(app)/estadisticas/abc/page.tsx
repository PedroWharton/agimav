import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Layers, ListOrdered, Wallet } from "lucide-react";

import { auth } from "@/lib/auth";
import { requireViewOrRedirect } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { InlineState } from "@/components/app/states";
import { AbcBadge } from "@/components/stats/abc-badge";
import { ChartCard } from "@/components/stats/chart-card";
import { Donut, type DonutSlice } from "@/components/stats/donut";
import { KpiCard } from "@/components/stats/kpi-card";
import { RangeSelect } from "@/components/stats/range-select";
import { formatCurrencyARS, formatNumber } from "@/lib/stats/format";

import { computeAbc } from "./actions";
import { ABC_RANGES, type AbcRange } from "./types";
import { AbcExportButton } from "./abc-export-button";

export const dynamic = "force-dynamic";

export default async function AbcPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "estadisticas.view");

  const t = await getTranslations("estadisticas");
  const sp = await searchParams;

  const range: AbcRange = (ABC_RANGES as readonly string[]).includes(
    sp.range ?? "",
  )
    ? (sp.range as AbcRange)
    : "90d";

  const { rows, valorTotal, sinConsumo, porClase } = await computeAbc(range);

  const rangoOptions = ABC_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));

  const clasesConteo = rows.reduce(
    (acc, r) => {
      acc[r.clase] = (acc[r.clase] ?? 0) + 1;
      return acc;
    },
    { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>,
  );

  const donutSlices: DonutSlice[] = (
    [
      { label: "A", value: porClase.a, tone: "brand" },
      { label: "B", value: porClase.b, tone: "warn" },
      { label: "C", value: porClase.c, tone: "neutral" },
    ] satisfies DonutSlice[]
  ).filter((s) => s.value > 0);

  const clasesLegend: { key: "A" | "B" | "C"; color: string; label: string; value: number }[] = [
    { key: "A", color: "var(--brand)", label: t("abc.clases.a"), value: porClase.a },
    { key: "B", color: "var(--warn)", label: t("abc.clases.b"), value: porClase.b },
    { key: "C", color: "var(--muted-foreground)", label: t("abc.clases.c"), value: porClase.c },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/estadisticas">
            <ArrowLeft className="size-4" />
            {t("abc.volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("abc.titulo")}
          description={t("abc.descripcion")}
          actions={
            <div className="flex items-center gap-2">
              <RangeSelect<AbcRange>
                current={range}
                options={rangoOptions}
                ariaLabel={t("abc.titulo")}
              />
              <AbcExportButton range={range} />
            </div>
          }
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Wallet}
          label={t("abc.kpi.valorTotal")}
          value={formatCurrencyARS(valorTotal)}
          caption={t("abc.kpi.valorTotalCaption")}
        />
        <KpiCard
          icon={ListOrdered}
          tone="info"
          label={t("abc.kpi.items")}
          value={rows.length.toLocaleString("es-AR")}
          caption={t("abc.kpi.itemsCaption", { count: rows.length })}
        />
        <KpiCard
          icon={Layers}
          tone="warn"
          label={t("abc.kpi.claseA")}
          value={clasesConteo.A.toLocaleString("es-AR")}
          caption={t("abc.kpi.claseACaption", { count: clasesConteo.A })}
        />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ChartCard
            title={t("abc.tablaTitulo")}
            subtitle={t("abc.tablaSubtitulo")}
          >
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <InlineState>{t("abc.vacio")}</InlineState>
              </div>
            ) : (
              <div className="-mx-5 -mb-5 overflow-hidden border-t border-border">
                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("abc.columnas.codigo")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("abc.columnas.descripcion")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("abc.columnas.cantidad")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("abc.columnas.valor")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("abc.columnas.porcentaje")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("abc.columnas.acumulado")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-center">
                          {t("abc.columnas.clase")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-t border-border hover:bg-muted/40"
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            {r.codigo ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {r.descripcion ?? "—"}
                            {r.unidadMedida ? (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({r.unidadMedida})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatNumber(r.cantidadConsumida, 2)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrencyARS(r.valorConsumido)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.porcentaje.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.acumulado.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            <AbcBadge clase={r.clase} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 text-xs">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 font-medium">
                          {t("abc.totalValor")}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrencyARS(valorTotal)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="lg:col-span-4">
          <ChartCard
            title={t("abc.distribucion")}
            subtitle={t("abc.distribucionSubtitulo")}
          >
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <InlineState>{t("abc.vacio")}</InlineState>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Donut
                  data={donutSlices}
                  size={160}
                  ariaLabel={t("abc.distribucion")}
                  centerLabel={
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrencyARS(valorTotal)}
                      </span>
                      <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
                        {t("abc.totalValor")}
                      </span>
                    </div>
                  }
                />
                <ul className="w-full space-y-1.5 text-xs">
                  {clasesLegend.map((c) => (
                    <li
                      key={c.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="truncate text-foreground">
                          {c.label}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {formatCurrencyARS(c.value)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto w-full border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
                  {t("abc.sinConsumo", { count: sinConsumo })}
                </p>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
