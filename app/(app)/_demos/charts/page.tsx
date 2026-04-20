import { Donut } from "@/components/stats/donut";
import { Heatmap } from "@/components/stats/heatmap";
import { HorizontalBars } from "@/components/stats/horizontal-bars";
import { StackedBars } from "@/components/stats/stacked-bars";

function SectionHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {lead ? (
        <p className="max-w-[520px] text-right text-[12.5px] leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function DocCard({
  label,
  usage,
  children,
}: {
  label: string;
  usage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        {usage ? <span className="font-medium text-foreground">{usage}</span> : null}
      </div>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}

function LegendSwatch({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="flex-1 text-foreground">{label}</span>
      {value ? (
        <span className="font-mono font-medium text-muted-foreground">{value}</span>
      ) : null}
    </div>
  );
}

// ---------- Synthetic data ----------

const donutData = [
  { label: "Preventivo", value: 114, tone: "info" as const },
  { label: "Correctivo", value: 52, tone: "danger" as const },
  { label: "Mejora", value: 18, tone: "ok" as const },
];

const otifRows = [
  { label: "Hidrorepuestos SRL", value: 94, tone: "ok" as const, objective: 90 },
  { label: "Filtros Argentina S.A.", value: 91, tone: "ok" as const, objective: 90 },
  { label: "Neumáticos del Sur", value: 88, tone: "warn" as const, objective: 90 },
  { label: "Lubricantes Patagónicos", value: 82, tone: "warn" as const, objective: 90 },
  { label: "Repuestos Don Carlos", value: 76, tone: "danger" as const, objective: 90 },
  { label: "Metalúrgica Río Negro", value: 64, tone: "danger" as const, objective: 90 },
];

const backlogRows = [
  { label: "MAQ-017 · Volvo L120", value: 48, tone: "danger" as const },
  { label: "MAQ-042 · CAT 320", value: 36, tone: "warn" as const },
  { label: "MAQ-063 · Komatsu PC200", value: 30, tone: "warn" as const },
  { label: "MAQ-024 · JCB 3CX", value: 22, tone: "info" as const },
  { label: "MAQ-008 · Case 721", value: 14, tone: "info" as const },
  { label: "MAQ-051 · Fiat Allis", value: 8, tone: "neutral" as const },
];

const spendData = [
  {
    label: "May",
    segments: [
      { key: "Repuestos", value: 2.4 },
      { key: "Combustible", value: 1.1 },
      { key: "Lubricantes", value: 0.6 },
      { key: "Otros", value: 0.4 },
    ],
  },
  {
    label: "Jun",
    segments: [
      { key: "Repuestos", value: 2.1 },
      { key: "Combustible", value: 1.3 },
      { key: "Lubricantes", value: 0.7 },
      { key: "Otros", value: 0.3 },
    ],
  },
  {
    label: "Jul",
    segments: [
      { key: "Repuestos", value: 2.6 },
      { key: "Combustible", value: 1.2 },
      { key: "Lubricantes", value: 0.5 },
      { key: "Otros", value: 0.5 },
    ],
  },
  {
    label: "Ago",
    segments: [
      { key: "Repuestos", value: 2.9 },
      { key: "Combustible", value: 1.4 },
      { key: "Lubricantes", value: 0.8 },
      { key: "Otros", value: 0.3 },
    ],
  },
  {
    label: "Sep",
    segments: [
      { key: "Repuestos", value: 2.2 },
      { key: "Combustible", value: 1.0 },
      { key: "Lubricantes", value: 0.6 },
      { key: "Otros", value: 0.4 },
    ],
  },
  {
    label: "Oct",
    segments: [
      { key: "Repuestos", value: 3.1 },
      { key: "Combustible", value: 1.5 },
      { key: "Lubricantes", value: 0.7 },
      { key: "Otros", value: 0.6 },
    ],
  },
];

const spendOrder = ["Repuestos", "Combustible", "Lubricantes", "Otros"];
const spendLegendColors = ["var(--brand)", "var(--info)", "var(--success)", "var(--warn)"];

// Heatmap: 5 machines × 12 weeks, deterministic values.
const heatmapMachines = ["MAQ-008", "MAQ-017", "MAQ-024", "MAQ-042", "MAQ-063"];
const heatmapWeeks = Array.from({ length: 12 }, (_, i) => `s${String(i + 5).padStart(2, "0")}`);
const heatmapRawValues: number[][] = [
  [ 0,  4,  8,  2, 12,  6,  0, 38, 18,  4,  2,  6],
  [ 2, 10, 14,  6, 32, 10,  8,  6,  4, 16,  2,  0],
  [ 0,  0,  4,  8, 12,  6, 10, 14, 22, 18, 28,  4],
  [ 6,  8,  2, 14, 20, 12, 10,  8, 16, 22, 18, 34],
  [12, 16, 20, 14,  8, 10, 18, 24, 14, 10,  6,  0],
];
const heatmapData = heatmapMachines.flatMap((row, ri) =>
  heatmapWeeks.map((col, ci) => ({
    row,
    col,
    value: heatmapRawValues[ri]?.[ci] ?? 0,
  })),
);

const fmtMillions = (n: number) => `${n.toFixed(1)}M`;
const fmtPercent = (n: number) => `${n}%`;
const fmtHours = (n: number) => `${n}h`;

export default function ChartsDemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Gráficos (R8-03)</h1>
        <p className="text-sm text-muted-foreground">
          Primitivas SVG para el dashboard de Estadísticas. Hand-rolled, sin Recharts.
          Todos los colores derivan de tokens (<code>var(--brand)</code>, <code>var(--success)</code>,
          etc.), por lo que el modo oscuro funciona sin cambios.
        </p>
      </header>

      {/* =============== DONUT =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="Donut"
          lead="Generalización de AbcPie. Slices coloreadas por tone o color explícito. Centro admite cualquier ReactNode; si se omite, muestra la suma."
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DocCard label="Donut · tones" usage="mezcla de OT · 90 días">
            <div className="flex items-center gap-6">
              <Donut data={donutData} size={160} />
              <div className="flex flex-1 flex-col gap-2">
                <LegendSwatch color="var(--info)" label="Preventivo" value="62%" />
                <LegendSwatch color="var(--danger)" label="Correctivo" value="28%" />
                <LegendSwatch color="var(--success)" label="Mejora" value="10%" />
              </div>
            </div>
          </DocCard>

          <DocCard label="Donut · centerLabel custom" usage="KPI principal">
            <div className="flex items-center gap-6">
              <Donut
                data={donutData}
                size={160}
                innerRatio={0.7}
                centerLabel={
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-lg font-semibold text-foreground">
                      184
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      OT / 90d
                    </span>
                  </div>
                }
              />
              <div className="flex flex-1 flex-col gap-2">
                <LegendSwatch color="var(--info)" label="Preventivo" value="114" />
                <LegendSwatch color="var(--danger)" label="Correctivo" value="52" />
                <LegendSwatch color="var(--success)" label="Mejora" value="18" />
              </div>
            </div>
          </DocCard>

          <DocCard label="Donut · sin datos" usage="estado vacío">
            <div className="flex items-center gap-6">
              <Donut data={[]} size={160} centerLabel={<span className="text-xs text-muted-foreground">Sin datos</span>} />
              <p className="text-xs text-muted-foreground">
                Cuando <code>total &lt;= 0</code> el anillo se renderiza como borde
                punteado usando <code>var(--border)</code>.
              </p>
            </div>
          </DocCard>

          <DocCard label="Donut · innerRatio 0" usage="pie">
            <Donut
              data={[
                { label: "A", value: 45, tone: "brand" },
                { label: "B", value: 30, tone: "warn" },
                { label: "C", value: 25, tone: "neutral" },
              ]}
              size={160}
              innerRatio={0}
              centerLabel={null}
            />
          </DocCard>
        </div>
      </section>

      {/* =============== HORIZONTAL BARS =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="HorizontalBars"
          lead="Filas etiquetadas con barra horizontal, línea de objetivo opcional y etiqueta numérica."
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DocCard label="HorizontalBars · con objetivo" usage="OTIF proveedores">
            <HorizontalBars
              data={otifRows}
              maxValue={100}
              formatValue={fmtPercent}
            />
          </DocCard>

          <DocCard label="HorizontalBars · backlog horas" usage="top 10 máquinas">
            <HorizontalBars data={backlogRows} formatValue={fmtHours} />
          </DocCard>

          <DocCard label='HorizontalBars · variant="mini"' usage="sparkbar compacto">
            <HorizontalBars
              variant="mini"
              data={backlogRows.slice(0, 4)}
              formatValue={fmtHours}
            />
          </DocCard>

          <DocCard label="HorizontalBars · sin etiquetas" usage="showValueLabels=false">
            <HorizontalBars
              data={otifRows.slice(0, 4)}
              maxValue={100}
              showValueLabels={false}
            />
          </DocCard>
        </div>
      </section>

      {/* =============== STACKED BARS =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="StackedBars"
          lead="Vertical, un grupo por período, segmentos apilados por clave. Leyenda la provee el caller."
        />
        <DocCard
          label="StackedBars · gasto mensual por rubro"
          usage="últimos 6 meses · ARS"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4">
              {spendOrder.map((key, i) => (
                <LegendSwatch
                  key={key}
                  color={spendLegendColors[i] ?? "var(--muted-foreground)"}
                  label={key}
                />
              ))}
            </div>
            <StackedBars
              data={spendData}
              segmentOrder={spendOrder}
              formatValue={fmtMillions}
            />
          </div>
        </DocCard>
      </section>

      {/* =============== HEATMAP =============== */}
      <section className="space-y-3.5">
        <SectionHeading
          title="Heatmap"
          lead="Grilla N×M. Escala por defecto: var(--card) → var(--danger). Celdas faltantes = 0."
        />
        <DocCard
          label="Heatmap · horas de parada"
          usage="5 máquinas × 12 semanas"
        >
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <Heatmap
                rows={heatmapMachines}
                cols={heatmapWeeks}
                data={heatmapData}
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-[10.5px] text-muted-foreground">
              <span>Menos</span>
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "color-mix(in oklch, var(--danger) 10%, var(--card))" }}
              />
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "color-mix(in oklch, var(--danger) 35%, var(--card))" }}
              />
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "color-mix(in oklch, var(--danger) 65%, var(--card))" }}
              />
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "color-mix(in oklch, var(--danger) 90%, var(--card))" }}
              />
              <span>Más</span>
            </div>
          </div>
        </DocCard>
      </section>
    </div>
  );
}
