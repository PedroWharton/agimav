import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { AbcBadge } from "@/components/stats/abc-badge";
import { AbcPie } from "@/components/stats/abc-pie";
import { RangeSelect } from "@/components/stats/range-select";

import { computeAbc } from "./actions";
import { ABC_RANGES, type AbcRange } from "./types";
import { AbcExportButton } from "./abc-export-button";

export const dynamic = "force-dynamic";

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

export default async function AbcPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        <div className="overflow-hidden rounded-lg border border-border">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("abc.vacio")}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
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
                        {formatNumber(r.cantidadConsumida)}
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
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-medium">
              {t("abc.distribucion")}
            </h3>
            <div className="flex flex-col items-center gap-3">
              <AbcPie a={porClase.a} b={porClase.b} c={porClase.c} />
              <ul className="w-full space-y-1 text-xs">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-sky-500/80" />
                    {t("abc.clases.a")}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrencyARS(porClase.a)}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-amber-500/80" />
                    {t("abc.clases.b")}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrencyARS(porClase.b)}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-muted-foreground/60" />
                    {t("abc.clases.c")}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrencyARS(porClase.c)}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            {t("abc.sinConsumo", { count: sinConsumo })}
          </div>
        </aside>
      </div>
    </div>
  );
}
