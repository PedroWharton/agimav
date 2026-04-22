import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  Building2,
  ChevronRight,
  LineChart,
  Tractor,
} from "lucide-react";

import { StatsFilterBar } from "@/components/stats/stats-filter-bar";
import { auth } from "@/lib/auth";
import {
  loadBacklogPorMaquina,
  loadGastoPorRubro,
  loadHorasParadaHeatmap,
  loadKpis,
  loadMezclaOt,
  loadOtifProveedores,
  loadProductividadTecnicos,
  loadRepuestosConsumidos,
  loadTallerTrend,
} from "@/lib/stats/dashboard";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, InlineState } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/stats/chart-card";
import { Donut, type DonutSlice } from "@/components/stats/donut";
import { Heatmap } from "@/components/stats/heatmap";
import {
  HorizontalBars,
  type HorizontalBarRow,
  type HorizontalBarTone,
} from "@/components/stats/horizontal-bars";
import { KpiCard } from "@/components/stats/kpi-card";
import { StackedBars } from "@/components/stats/stacked-bars";

export const dynamic = "force-dynamic";

// ─── formatters ───────────────────────────────────────────────────────────

function formatCurrencyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCurrencyShort(n: number) {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function formatMonthShort(ymKey: string) {
  const [y, m] = ymKey.split("-").map((s) => Number(s));
  if (!y || !m) return ymKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("es-AR", { month: "short" });
}

function formatMonthYear(ymKey: string) {
  const [y, m] = ymKey.split("-").map((s) => Number(s));
  if (!y || !m) return ymKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("es-AR", { month: "short", year: "2-digit" });
}

// ─── local helpers ────────────────────────────────────────────────────────

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function LegendSwatch({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{label}</span>
      {value ? (
        <span className="font-mono font-medium text-foreground">{value}</span>
      ) : null}
    </span>
  );
}

// ─── chart card implementations ───────────────────────────────────────────

function MezclaCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadMezclaOt>>;
  t: TranslateFn;
}) {
  const toneMap: Record<
    string,
    { tone: DonutSlice["tone"]; color: string; label: string }
  > = {
    correctivo: {
      tone: "danger",
      color: "var(--danger)",
      label: t("dashboard.tipos.correctivo"),
    },
    preventivo: {
      tone: "info",
      color: "var(--info)",
      label: t("dashboard.tipos.preventivo"),
    },
    mejora: {
      tone: "ok",
      color: "var(--success)",
      label: t("dashboard.tipos.mejora"),
    },
  };
  const slices: DonutSlice[] = data.map((d) => {
    const entry = toneMap[d.tipo.toLowerCase()];
    return {
      label: entry?.label ?? d.tipo,
      value: d.count,
      tone: entry?.tone ?? "neutral",
    };
  });
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const preventivos =
    data.find((d) => d.tipo.toLowerCase() === "preventivo")?.count ?? 0;
  const correctivos =
    data.find((d) => d.tipo.toLowerCase() === "correctivo")?.count ?? 0;
  const ratio =
    correctivos > 0 ? (preventivos / correctivos).toFixed(2) : "—";

  return (
    <ChartCard
      title={t("dashboard.mezcla.titulo")}
      subtitle={t("dashboard.mezcla.subtitulo")}
      linkHref="/estadisticas/maquinaria"
      linkLabel={t("dashboard.mezcla.verMas")}
    >
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <Donut
            data={slices}
            size={140}
            centerLabel={
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-mono text-lg font-semibold text-foreground">
                  {total}
                </span>
                <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
                  {t("dashboard.mezcla.totalCaption")}
                </span>
              </div>
            }
          />
          <div className="flex flex-1 flex-col gap-2 text-[12px]">
            {slices.map((s) => {
              const entry = Object.values(toneMap).find(
                (v) => v.label === s.label,
              );
              const color = entry?.color ?? "var(--muted-foreground)";
              const pct =
                total > 0 ? ((s.value / total) * 100).toFixed(0) : "0";
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-foreground">{s.label}</span>
                  <span className="font-mono font-medium text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              );
            })}
            <div className="mt-2 flex items-center gap-2 border-t border-dashed border-border pt-2 text-muted-foreground">
              <span className="flex-1">{t("dashboard.mezcla.ratio")}</span>
              <span className="font-mono font-medium text-foreground">
                {ratio}
              </span>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function RepuestosCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadRepuestosConsumidos>>;
  t: TranslateFn;
}) {
  const maxCosto = data.reduce((m, d) => (d.costoTotal > m ? d.costoTotal : m), 0);

  return (
    <ChartCard
      title={t("dashboard.repuestos.titulo")}
      subtitle={t("dashboard.repuestos.subtitulo")}
      linkHref="/estadisticas/abc"
      linkLabel={t("dashboard.repuestos.verMas")}
    >
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {data.map((d, i) => {
            const pct = maxCosto > 0 ? (d.costoTotal / maxCosto) * 100 : 0;
            const label = d.codigo ?? d.descripcion ?? `#${d.itemId}`;
            return (
              <li
                key={d.itemId}
                className="flex items-center gap-3 rounded-md px-1 py-1 text-[12.5px]"
              >
                <span className="w-5 font-mono text-[10.5px] font-semibold text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {label}
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
                <span className="font-mono text-[11.5px] font-semibold tabular-nums text-foreground">
                  {formatCurrencyShort(d.costoTotal)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </ChartCard>
  );
}

function BacklogCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadBacklogPorMaquina>>;
  t: TranslateFn;
}) {
  const rows: HorizontalBarRow[] = data.map((d) => {
    let tone: HorizontalBarTone = "info";
    if (d.pendientes >= 8) tone = "danger";
    else if (d.pendientes >= 4) tone = "warn";
    return { label: d.label, value: d.pendientes, tone };
  });

  return (
    <ChartCard
      title={t("dashboard.backlog.titulo")}
      subtitle={t("dashboard.backlog.subtitulo")}
      linkHref="/mantenimiento"
    >
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <HorizontalBars data={rows} formatValue={(n) => `${n}`} />
      )}
    </ChartCard>
  );
}

function OtifCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadOtifProveedores>>;
  t: TranslateFn;
}) {
  const rows: HorizontalBarRow[] = data.map((d) => {
    let tone: HorizontalBarTone = "danger";
    if (d.pct >= 90) tone = "ok";
    else if (d.pct >= 80) tone = "warn";
    return {
      label: d.nombre,
      value: d.pct,
      tone,
      objective: 90,
    };
  });

  return (
    <ChartCard
      title={t("dashboard.otif.titulo")}
      subtitle={t("dashboard.otif.subtitulo")}
      linkHref="/estadisticas/proveedores"
      linkLabel={t("dashboard.otif.verMas")}
    >
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            variant="empty-tab"
            title={t("dashboard.sinDatos")}
            description={undefined}
          />
        </div>
      ) : (
        <>
          <HorizontalBars
            data={rows}
            maxValue={100}
            formatValue={(n) => `${Math.round(n)}%`}
          />
          <div className="mt-1 flex justify-end">
            <span className="text-[10.5px] text-muted-foreground">
              — {t("dashboard.otif.objetivo")}
            </span>
          </div>
        </>
      )}
    </ChartCard>
  );
}

function TecnicosCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadProductividadTecnicos>>;
  t: TranslateFn;
}) {
  const rows: HorizontalBarRow[] = data.map((d) => ({
    label: d.nombre,
    value: d.mantenimientos,
    tone: "brand" as HorizontalBarTone,
  }));

  return (
    <ChartCard
      title={t("dashboard.tecnicos.titulo")}
      subtitle={t("dashboard.tecnicos.subtitulo")}
    >
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <HorizontalBars data={rows} formatValue={(n) => `${n}`} />
      )}
    </ChartCard>
  );
}

function TallerTrendCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadTallerTrend>>;
  t: TranslateFn;
}) {
  // data is already 12 months oldest → newest.
  const hasAny =
    data.length > 0 &&
    data.some((p) => p.mantenimientos > 0 || p.gasto > 0);
  const values = data.map((p) => p.gasto);
  const labels = data.map((p) => formatMonthYear(p.mes));

  // Bar geometry (bars render mantenimientos) — inline SVG keeps this self-contained
  // and in-tune with the spark line token (currentColor on the svg is sky-600).
  const w = 720;
  const h = 200;
  const pL = 36;
  const pR = 40;
  const pT = 14;
  const pB = 26;
  const innerH = h - pT - pB;
  const innerW = w - pL - pR;
  const maxMant = Math.max(1, ...data.map((p) => p.mantenimientos));
  const slot = innerW / Math.max(1, data.length);
  const bw = Math.min(24, slot * 0.55);

  const maxGasto = Math.max(1, ...values);
  const gastoPts = data.map((p, i) => {
    const cx = pL + i * slot + slot / 2;
    const y = pT + innerH - (p.gasto / maxGasto) * innerH;
    return { x: cx, y };
  });
  const linePoints = gastoPts.map((p) => `${p.x},${p.y}`).join(" ");

  // Y axis: left (mant count) ticks 0, mid, max
  const leftTicks = [0, Math.ceil(maxMant / 2), maxMant];

  return (
    <ChartCard
      title={t("dashboard.taller.titulo")}
      subtitle={t("dashboard.taller.subtitulo")}
    >
      {!hasAny ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            <LegendSwatch
              color="var(--info)"
              label={t("dashboard.taller.legendaMant")}
            />
            <LegendSwatch
              color="var(--brand)"
              label={t("dashboard.taller.legendaGasto")}
            />
          </div>
          <svg
            role="img"
            aria-label={t("dashboard.taller.titulo")}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height={h}
            className="block"
          >
            <desc>
              {t("dashboard.taller.titulo")}:{" "}
              {data
                .map(
                  (p) =>
                    `${formatMonthYear(p.mes)} ${p.mantenimientos}m / ${formatCurrencyShort(p.gasto)}`,
                )
                .join(", ")}
            </desc>
            {leftTicks.map((v, i) => {
              const y = pT + innerH - (v / maxMant) * innerH;
              return (
                <g key={`tick-${i}`}>
                  <line
                    x1={pL}
                    x2={w - pR}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.6}
                  />
                  <text
                    x={pL - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 10 }}
                  >
                    {v}
                  </text>
                </g>
              );
            })}
            {data.map((p, i) => {
              const cx = pL + i * slot + slot / 2;
              const bh = (p.mantenimientos / maxMant) * innerH;
              const y = pT + innerH - bh;
              return (
                <g key={`bar-${p.mes}`}>
                  <rect
                    x={cx - bw / 2}
                    y={y}
                    width={bw}
                    height={bh}
                    fill="var(--info)"
                    opacity={0.35}
                    rx={2}
                  >
                    <title>
                      {formatMonthYear(p.mes)}: {p.mantenimientos} mant.
                    </title>
                  </rect>
                  <text
                    x={cx}
                    y={h - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 10 }}
                  >
                    {formatMonthShort(p.mes)}
                  </text>
                </g>
              );
            })}
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {gastoPts.map((p, i) => (
              <circle
                key={`dot-${i}`}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill="var(--brand)"
              >
                <title>
                  {labels[i]}: {formatCurrencyARS(values[i] ?? 0)}
                </title>
              </circle>
            ))}
          </svg>
          <div className="flex justify-end text-[10px] text-muted-foreground">
            <span>
              máx. {formatCurrencyShort(maxGasto)} · {maxMant} mant.
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function GastoRubroCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadGastoPorRubro>>;
  t: TranslateFn;
}) {
  const hasAny =
    data.data.length > 0 &&
    data.data.some((g) => g.segments.some((s) => s.value > 0));

  const palette = ["var(--brand)", "var(--info)", "var(--success)", "var(--muted-foreground)"];

  return (
    <ChartCard
      title={t("dashboard.gasto.titulo")}
      subtitle={t("dashboard.gasto.subtitulo")}
      linkHref="/estadisticas/proveedores"
    >
      {!hasAny ? (
        <div className="flex flex-1 items-center justify-center">
          <InlineState>{t("dashboard.sinDatos")}</InlineState>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            {data.order.map((key, i) => (
              <LegendSwatch
                key={`${key}-${i}`}
                color={palette[i] ?? "var(--muted-foreground)"}
                label={key}
              />
            ))}
          </div>
          <StackedBars
            data={data.data.map((g) => ({
              label: formatMonthShort(g.mes),
              segments: g.segments,
            }))}
            segmentOrder={data.order}
            formatValue={formatCurrencyShort}
          />
        </div>
      )}
    </ChartCard>
  );
}

function HeatmapCard({
  data,
  t,
}: {
  data: Awaited<ReturnType<typeof loadHorasParadaHeatmap>>;
  t: TranslateFn;
}) {
  const hasAny =
    data.cells.length > 0 && data.cells.some((c) => c.value > 0);

  return (
    <ChartCard
      title={t("dashboard.heatmap.titulo")}
      subtitle={t("dashboard.heatmap.subtitulo", {
        count: data.rows.length || 5,
        weeks: data.cols.length || 12,
      })}
    >
      {!hasAny ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            variant="empty-tab"
            title={t("dashboard.sinDatos")}
            description={undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <Heatmap
              rows={data.rows}
              cols={data.cols}
              data={data.cells}
              cellSize={32}
              labelCol={88}
            />
          </div>
          <div className="flex items-center justify-end gap-2 text-[10.5px] text-muted-foreground">
            <span>{t("dashboard.heatmap.leyendaMenos")}</span>
            {[10, 35, 65, 90].map((pct) => (
              <span
                key={pct}
                className="inline-block h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: `color-mix(in oklch, var(--danger) ${pct}%, var(--card))`,
                }}
                aria-hidden
              />
            ))}
            <span>{t("dashboard.heatmap.leyendaMas")}</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────

export default async function EstadisticasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("estadisticas");
  const tRoot = (key: string, values?: Record<string, string | number>) =>
    t(key, values);

  const [
    kpis,
    mezcla,
    repuestos,
    backlog,
    otif,
    tecnicos,
    tallerTrend,
    gastoRubro,
    heatmap,
  ] = await Promise.all([
    loadKpis(),
    loadMezclaOt(),
    loadRepuestosConsumidos(6),
    loadBacklogPorMaquina(10),
    loadOtifProveedores(6),
    loadProductividadTecnicos(6),
    loadTallerTrend(),
    loadGastoPorRubro(6, 3),
    loadHorasParadaHeatmap(12, 5),
  ]);

  const mesActual = new Date().toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const hoy = new Date();
  const lookbackDias = 90;
  const desde = new Date(hoy.getTime() - lookbackDias * 24 * 60 * 60 * 1000);
  const fmtDia = (d: Date) =>
    d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  const fmtDiaAnio = (d: Date) =>
    d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const rangeLabel = `${fmtDia(desde)} — ${fmtDiaAnio(hoy)} · ${lookbackDias}d`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("titulo")}
        description={
          <>
            {t("dashboard.subtitulo")} ·{" "}
            <span className="font-medium text-foreground">
              {t("dashboard.subtituloPeriodo")}
            </span>
          </>
        }
      />

      <StatsFilterBar rangeLabel={rangeLabel} granularity="mes" />

      {/* KPI strip — 4 cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          size="lg"
          tone={kpis.disponibilidadPct >= 85 ? "ok" : "warn"}
          label={t("dashboard.kpi.disponibilidad")}
          value={`${kpis.disponibilidadPct.toFixed(1)}%`}
          caption={t("dashboard.kpi.disponibilidadCaption", {
            activas: kpis.maquinasActivas,
            total: kpis.maquinasTotales,
          })}
          href="/maquinaria"
        />
        <KpiCard
          size="lg"
          tone={kpis.mantPendientes > 10 ? "warn" : "neutral"}
          label={t("dashboard.kpi.mantPendientes")}
          value={kpis.mantPendientes.toLocaleString("es-AR")}
          caption={t("dashboard.kpi.mantPendientesCaption")}
          href="/mantenimiento"
        />
        <KpiCard
          size="lg"
          tone="info"
          label={t("dashboard.kpi.otEnCurso")}
          value={kpis.otEnCurso.toLocaleString("es-AR")}
          caption={t("dashboard.kpi.otEnCursoCaption")}
          href="/ordenes-trabajo"
        />
        <KpiCard
          size="lg"
          label={t("dashboard.kpi.facturacionMes")}
          value={formatCurrencyARS(kpis.facturacionMesTotal)}
          caption={t("dashboard.kpi.facturacionMesCaption", {
            count: kpis.facturacionMesCount,
            mes: mesActual,
          })}
          href="/compras/facturas"
        />
      </div>

      {/* 12-col chart grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        {/* 2. Mezcla de OT */}
        <div className="md:col-span-3 lg:col-span-4">
          <MezclaCard data={mezcla} t={tRoot} />
        </div>

        {/* 3. Repuestos consumidos */}
        <div className="md:col-span-3 lg:col-span-4">
          <RepuestosCard data={repuestos} t={tRoot} />
        </div>

        {/* 4. Backlog por máquina */}
        <div className="md:col-span-6 lg:col-span-4">
          <BacklogCard data={backlog} t={tRoot} />
        </div>

        {/* 5. OTIF proveedores */}
        <div className="md:col-span-6 lg:col-span-6">
          <OtifCard data={otif} t={tRoot} />
        </div>

        {/* 6. Productividad técnicos */}
        <div className="md:col-span-6 lg:col-span-6">
          <TecnicosCard data={tecnicos} t={tRoot} />
        </div>

        {/* 7. Disponibilidad / carga taller (dual-axis) */}
        <div className="md:col-span-6 lg:col-span-8">
          <TallerTrendCard data={tallerTrend} t={tRoot} />
        </div>

        {/* 8. Gasto por rubro */}
        <div className="md:col-span-6 lg:col-span-4">
          <GastoRubroCard data={gastoRubro} t={tRoot} />
        </div>

        {/* 9. Heatmap correctivos */}
        <div className="md:col-span-6 lg:col-span-12">
          <HeatmapCard data={heatmap} t={tRoot} />
        </div>
      </div>

      {/* Análisis detallados — preserved links to sub-routes */}
      <div className="border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t("lentes.titulo")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SubRouteCard
            href="/estadisticas/abc"
            icon={<BarChart3 className="size-5 text-muted-foreground" />}
            title={t("lentes.abc")}
            description={t("lentes.abcDesc")}
          />
          <SubRouteCard
            href="/estadisticas/precios"
            icon={<LineChart className="size-5 text-muted-foreground" />}
            title={t("lentes.precios")}
            description={t("lentes.preciosDesc")}
          />
          <SubRouteCard
            href="/estadisticas/maquinaria"
            icon={<Tractor className="size-5 text-muted-foreground" />}
            title={t("lentes.maquinaria")}
            description={t("lentes.maquinariaDesc")}
          />
          <SubRouteCard
            href="/estadisticas/proveedores"
            icon={<Building2 className="size-5 text-muted-foreground" />}
            title={t("lentes.proveedores")}
            description={t("lentes.proveedoresDesc")}
          />
        </div>
      </div>

    </div>
  );
}

function SubRouteCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="flex h-full items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">{icon}</div>
          <div className="flex flex-col">
            <span className="font-medium">{title}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}
