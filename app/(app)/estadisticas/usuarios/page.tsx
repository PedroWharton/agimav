import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Users, Wallet, ClipboardList, Info, X } from "lucide-react";

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
import { EstadoChip } from "@/components/compras/estado-chip";

import { computeDetalleUsuario, computeGastoPorUsuario } from "./actions";
import { USR_RANGES, type UsrRange } from "./types";
import { UsuariosExportButton } from "./usuarios-export-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function UsuariosStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; usuario?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session, "estadisticas.proveedores.view")) {
    redirect("/estadisticas");
  }

  const t = await getTranslations("estadisticas");
  const sp = await searchParams;

  const range: UsrRange = (USR_RANGES as readonly string[]).includes(
    sp.range ?? "",
  )
    ? (sp.range as UsrRange)
    : "ytd";

  const usuarioSeleccionado = (sp.usuario ?? "").trim();

  const [{ rows, totalGasto, usuariosConGasto, requisicionesTotal }, detalle] =
    await Promise.all([
      computeGastoPorUsuario(range),
      usuarioSeleccionado
        ? computeDetalleUsuario(usuarioSeleccionado, range)
        : Promise.resolve(null),
    ]);

  const rangoOptions = USR_RANGES.map((r) => ({
    value: r,
    label: t(`rangos.${r}`),
  }));

  const top10: HorizontalBarRow[] = rows
    .filter((r) => r.gasto > 0)
    .slice(0, 10)
    .map((r) => ({ label: r.nombre, value: r.gasto, tone: "brand" }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/estadisticas">
            <ArrowLeft className="size-4" />
            {t("usuarios.volver")}
          </Link>
        </Button>
        <PageHeader
          title={t("usuarios.titulo")}
          description={t("usuarios.descripcion")}
          actions={
            <div className="flex items-center gap-2">
              <RangeSelect<UsrRange>
                current={range}
                options={rangoOptions}
                ariaLabel={t("usuarios.titulo")}
              />
              <UsuariosExportButton range={range} />
            </div>
          }
        />
      </div>

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-info/25 bg-info-weak px-3.5 py-3 text-[12.5px] leading-snug text-info"
      >
        <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
        <p>{t("usuarios.notaLegacy")}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Wallet}
          label={t("usuarios.kpi.total")}
          value={formatCurrencyARS(totalGasto)}
          caption={t("usuarios.kpi.totalCaption")}
        />
        <KpiCard
          icon={Users}
          tone="info"
          label={t("usuarios.kpi.usuarios")}
          value={String(usuariosConGasto)}
          caption={t("usuarios.kpi.usuariosCaption")}
        />
        <KpiCard
          icon={ClipboardList}
          tone="neutral"
          label={t("usuarios.kpi.requisiciones")}
          value={String(requisicionesTotal)}
          caption={t("usuarios.kpi.requisicionesCaption")}
        />
      </div>

      {rows.length === 0 ? (
        <ChartCard
          title={t("usuarios.tablaTitulo")}
          subtitle={t("usuarios.tablaSubtitulo")}
        >
          <div className="flex flex-1 items-center justify-center">
            <InlineState>{t("usuarios.vacio")}</InlineState>
          </div>
        </ChartCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ChartCard
              title={t("usuarios.tablaTitulo")}
              subtitle={t("usuarios.tablaSubtitulo")}
            >
              <div className="-mx-5 -mb-5 overflow-hidden border-t border-border">
                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("usuarios.columnas.usuario")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("usuarios.columnas.facturas")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("usuarios.columnas.gasto")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("usuarios.columnas.porcentaje")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          {t("usuarios.columnas.requisiciones")}
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">
                          {t("usuarios.columnas.ultima")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.nombre}
                          className={
                            r.nombre === usuarioSeleccionado
                              ? "border-t border-border bg-sky-50 dark:bg-sky-950/30"
                              : "border-t border-border hover:bg-muted/40"
                          }
                        >
                          <td className="px-3 py-2 font-medium">
                            <Link
                              href={`/estadisticas/usuarios?range=${range}&usuario=${encodeURIComponent(r.nombre)}`}
                              className="underline-offset-2 hover:text-sky-700 hover:underline dark:hover:text-sky-300"
                              title={t("usuarios.detalle.verDetalle")}
                            >
                              {r.nombre}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.facturas}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatCurrencyARS(r.gasto)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.porcentaje.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.requisiciones}
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
                          {t("usuarios.totalGeneral")}
                        </td>
                        <td />
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrencyARS(totalGasto)}
                        </td>
                        <td />
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {requisicionesTotal}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </ChartCard>
          </div>

          <div className="lg:col-span-5">
            <ChartCard
              title={t("usuarios.top")}
              subtitle={t("usuarios.topSubtitulo")}
            >
              {top10.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <InlineState>{t("usuarios.sinGasto")}</InlineState>
                </div>
              ) : (
                <HorizontalBars
                  data={top10}
                  formatValue={formatCurrencyShort}
                  ariaLabel={t("usuarios.top")}
                />
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {detalle ? (
        <ChartCard
          title={t("usuarios.detalle.titulo", { nombre: detalle.nombre })}
          subtitle={t("usuarios.detalle.subtitulo")}
          linkHref={`/compras/solicitudes?solicitante=${encodeURIComponent(detalle.nombre)}`}
          linkLabel={t("usuarios.detalle.verSolicitudes")}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                {t("usuarios.detalle.facturasTitulo", {
                  count: detalle.facturas.length,
                })}
              </h4>
              {detalle.facturas.length === 0 ? (
                <InlineState>{t("usuarios.detalle.sinFacturas")}</InlineState>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="max-h-[320px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.numero")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.proveedor")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.fecha")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            {t("usuarios.detalle.columnas.total")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.facturas.map((f) => (
                          <tr
                            key={f.id}
                            className="border-t border-border hover:bg-muted/40"
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              {f.numeroFactura}
                            </td>
                            <td className="px-3 py-2">{f.proveedor}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {formatDate(f.fechaFactura)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatCurrencyARS(f.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 text-xs">
                        <tr>
                          <td className="px-3 py-2 font-medium" colSpan={3}>
                            {t("usuarios.totalGeneral")}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {formatCurrencyARS(detalle.totalFacturado)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                {t("usuarios.detalle.requisicionesTitulo", {
                  count: detalle.requisiciones.length,
                })}
              </h4>
              {detalle.requisiciones.length === 0 ? (
                <InlineState>
                  {t("usuarios.detalle.sinRequisiciones")}
                </InlineState>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="max-h-[320px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.numero")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.fecha")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-left">
                            {t("usuarios.detalle.columnas.estado")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.requisiciones.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-border hover:bg-muted/40"
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              <Link
                                href={`/compras/solicitudes/${r.id}`}
                                className="underline-offset-2 hover:text-sky-700 hover:underline dark:hover:text-sky-300"
                              >
                                #{r.id}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {formatDate(r.fechaCreacion)}
                            </td>
                            <td className="px-3 py-2">
                              <EstadoChip estado={r.estado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/estadisticas/usuarios?range=${range}`}>
                <X className="size-4" />
                {t("usuarios.detalle.cerrar")}
              </Link>
            </Button>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
