import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { RangeSelect } from "@/components/stats/range-select";

import { computeMaqMetrics } from "./actions";
import {
  MAQ_RANGES,
  MIN_FILTROS,
  type MaqRange,
  type MinFiltro,
} from "./types";

export const dynamic = "force-dynamic";

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number, digits = 1) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits,
  }).format(n);
}

export default async function MaquinariaStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; min?: string }>;
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
  const minFiltro: MinFiltro = (MIN_FILTROS as readonly string[]).includes(
    sp.min ?? "",
  )
    ? (sp.min as MinFiltro)
    : "min2";

  const { rows, sinHistorial, totalMaquinas } = await computeMaqMetrics(
    range,
    minFiltro,
  );

  const rangoOptions = MAQ_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));
  const minOptions = MIN_FILTROS.map((f) => ({
    value: f,
    label: t(`maquinaria.filtros.${f}`),
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
            <div className="flex flex-wrap items-center gap-2">
              <RangeSelect<MinFiltro>
                current={minFiltro}
                options={minOptions}
                paramName="min"
                ariaLabel={t("maquinaria.titulo")}
              />
              <RangeSelect<MaqRange>
                current={range}
                options={rangoOptions}
                ariaLabel={t("maquinaria.titulo")}
              />
            </div>
          }
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {t("maquinaria.vacio")}
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">
                    {t("maquinaria.columnas.maquina")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("maquinaria.columnas.tipo")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.correctivos")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.preventivos")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.mtbf")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.horas")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("maquinaria.columnas.costo")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      {r.tipoId ? (
                        <Link
                          href={`/maquinaria/${r.tipoId}`}
                          className="font-medium hover:underline"
                        >
                          {r.nombre}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.nombre}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.tipoNombre ? (
                        <Badge variant="outline">{r.tipoNombre}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.correctivos}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.preventivos}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.mtbfDias !== null ? formatNumber(r.mtbfDias) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.horasOperadas !== null
                        ? formatNumber(r.horasOperadas, 0)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyARS(r.costoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="rounded-md border border-border px-3 py-1.5">
          {t("maquinaria.totales", { total: totalMaquinas })}
        </div>
        <div className="rounded-md border border-dashed border-border px-3 py-1.5">
          {t("maquinaria.sinHistorial", { count: sinHistorial })}
        </div>
      </div>
    </div>
  );
}
