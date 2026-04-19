import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { HorizontalBarChart } from "@/components/stats/bar-chart";
import { RangeSelect } from "@/components/stats/range-select";

import {
  PROV_RANGES,
  computeProveedoresGasto,
  type ProvRange,
} from "./actions";
import { ProveedoresExportButton } from "./proveedores-export-button";

export const dynamic = "force-dynamic";

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

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

  const bars = rows.map((r) => ({ label: r.nombre, value: r.total }));

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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("proveedores.vacio")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="max-h-[600px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      {t("proveedores.columnas.proveedor")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("proveedores.columnas.facturas")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("proveedores.columnas.total")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("proveedores.columnas.porcentaje")}
                    </th>
                    <th className="px-3 py-2 text-left">
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

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-medium">
                {t("proveedores.top")}
              </h3>
              <HorizontalBarChart
                bars={bars}
                formatValue={formatCurrencyARS}
                maxBars={10}
              />
            </div>
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              {t("proveedores.resumen", {
                con: proveedoresConFacturas,
                total: proveedoresTotales,
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
