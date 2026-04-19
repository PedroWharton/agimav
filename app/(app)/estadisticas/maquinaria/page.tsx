import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { RangeSelect } from "@/components/stats/range-select";

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

      <MaquinariaStatsClient rows={rows} />

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
