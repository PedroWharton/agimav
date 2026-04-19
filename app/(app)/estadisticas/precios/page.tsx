import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
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
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("precios.sinHistorial")}
        </div>
      ) : !series ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("precios.elegirItem")}
        </div>
      ) : series.points.length < 2 ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm">
            <span className="font-medium">
              {series.codigo ?? "—"}
            </span>{" "}
            — {series.descripcion ?? "—"}
          </div>
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t("precios.unSoloPunto")}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium">{series.codigo ?? "—"}</div>
              <div className="text-muted-foreground">
                {series.descripcion ?? "—"}
                {series.unidadMedida ? ` · ${series.unidadMedida}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 bg-sky-600" />
                ARS
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 border-t border-dashed border-amber-600" />
                USD
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border p-4">
            <PriceChart
              points={series.points}
              dolarFrom={series.dolarFrom}
              width={720}
              height={280}
            />
          </div>

          <div className="rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">
                    {t("precios.columnas.fecha")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("precios.columnas.ars")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("precios.columnas.usd")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("precios.columnas.proveedor")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.points.map((p, i) => (
                  <tr
                    key={`${p.fecha}-${i}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{p.fecha}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrencyARS(p.precioArs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
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
      )}
    </div>
  );
}
