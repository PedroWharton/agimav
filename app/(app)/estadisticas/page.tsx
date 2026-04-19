import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  ClipboardList,
  DollarSign,
  LineChart,
  ShoppingCart,
  Tractor,
  Wrench,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/stats/kpi-card";
import { SparkLine } from "@/components/stats/spark-line";

export const dynamic = "force-dynamic";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonth(ymKey: string) {
  // ymKey = "YYYY-MM"
  const [y, m] = ymKey.split("-").map((s) => Number(s));
  if (!y || !m) return ymKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("es-AR", { month: "short", year: "2-digit" });
}

async function loadKpis() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const twelveAgoStart = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1,
  );

  const [
    maquinasActivas,
    maquinasTotales,
    inventarioBajo,
    inventarioTotales,
    ocsAbiertas,
    ocsTotales,
    mantPendientes,
    otEnCurso,
    facturasMes,
    facturasSerie,
  ] = await Promise.all([
    prisma.maquinaria.count({ where: { estado: "Activo" } }),
    prisma.maquinaria.count(),
    prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*)::bigint as count FROM inventario WHERE stock < stock_minimo AND stock_minimo > 0`,
    prisma.inventario.count(),
    prisma.ordenCompra.count({
      where: { estado: { in: ["Emitida", "Parcialmente Recibida"] } },
    }),
    prisma.ordenCompra.count(),
    prisma.mantenimiento.count({ where: { estado: "Pendiente" } }),
    prisma.ordenTrabajo.count({ where: { estado: "En Curso" } }),
    prisma.factura.aggregate({
      where: { fechaFactura: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(date_trunc('month', fecha_factura), 'YYYY-MM') as mes,
             COALESCE(SUM(total), 0)::float as total
      FROM facturas
      WHERE fecha_factura >= ${twelveAgoStart}
      GROUP BY mes
      ORDER BY mes ASC
    `,
  ]);

  const bajoStock = Number(inventarioBajo[0]?.count ?? 0);

  // Fill missing months in the 12-month series with zeros
  const serieMap = new Map(facturasSerie.map((r) => [r.mes, r.total]));
  const serie: { mes: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    serie.push({ mes: key, total: serieMap.get(key) ?? 0 });
  }

  return {
    maquinasActivas,
    maquinasTotales,
    bajoStock,
    inventarioTotales,
    ocsAbiertas,
    ocsTotales,
    mantPendientes,
    otEnCurso,
    facturasMesTotal: facturasMes._sum.total ?? 0,
    facturasMesCount: facturasMes._count,
    serie,
  };
}

export default async function EstadisticasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("estadisticas");
  const kpi = await loadKpis();
  const admin = isAdmin(session);

  const serieValues = kpi.serie.map((p) => p.total);
  const serieLabels = kpi.serie.map((p) => formatMonth(p.mes));
  const mesActual = new Date().toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t("titulo")} description={t("descripcion")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={Tractor}
          label={t("kpi.maquinas")}
          value={kpi.maquinasActivas.toLocaleString("es-AR")}
          caption={t("kpi.maquinasCaption", {
            total: kpi.maquinasTotales,
          })}
          href="/maquinaria"
        />
        <KpiCard
          icon={AlertTriangle}
          tone={kpi.bajoStock > 0 ? "warn" : "default"}
          label={t("kpi.bajoStock")}
          value={kpi.bajoStock.toLocaleString("es-AR")}
          caption={t("kpi.bajoStockCaption", {
            total: kpi.inventarioTotales,
          })}
          href="/inventario"
        />
        <KpiCard
          icon={ShoppingCart}
          label={t("kpi.ocsAbiertas")}
          value={kpi.ocsAbiertas.toLocaleString("es-AR")}
          caption={t("kpi.ocsAbiertasCaption", { total: kpi.ocsTotales })}
          href="/compras/oc"
        />
        <KpiCard
          icon={Wrench}
          label={t("kpi.mantPendientes")}
          value={kpi.mantPendientes.toLocaleString("es-AR")}
          caption={t("kpi.mantPendientesCaption")}
          href="/mantenimiento"
        />
        <KpiCard
          icon={DollarSign}
          label={t("kpi.facturacionMes")}
          value={formatCurrencyARS(kpi.facturasMesTotal)}
          caption={t("kpi.facturacionMesCaption", {
            count: kpi.facturasMesCount,
            mes: mesActual,
          })}
          className="sm:col-span-2 lg:col-span-2"
        >
          <SparkLine
            values={serieValues}
            labels={serieLabels}
            width={280}
            height={40}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{serieLabels[0]}</span>
            <span>{serieLabels[serieLabels.length - 1]}</span>
          </div>
        </KpiCard>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t("lentes.titulo")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/estadisticas/abc">
            <Card className="flex h-full items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <BarChart3 className="size-5 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{t("lentes.abc")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("lentes.abcDesc")}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Card>
          </Link>
          <Link href="/estadisticas/precios">
            <Card className="flex h-full items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <LineChart className="size-5 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{t("lentes.precios")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("lentes.preciosDesc")}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Card>
          </Link>
        </div>
      </div>

      {admin ? (
        <div className="border-t border-border pt-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("adminSeccion")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              icon={ClipboardList}
              label={t("kpi.otEnCurso")}
              value={kpi.otEnCurso.toLocaleString("es-AR")}
              caption={t("kpi.otEnCursoCaption")}
              href="/ordenes-trabajo"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
