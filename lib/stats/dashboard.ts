import { prisma } from "@/lib/db";

/**
 * Data helpers for the /estadisticas dashboard (R8-04).
 *
 * All functions are server-side only and hit Prisma directly. No caching —
 * the page is `force-dynamic` and queries are cheap enough per-request.
 *
 * Each function is defensive: returns an empty array or zero so the UI can
 * render an `EmptyState` / `InlineState` instead of blowing up when legacy
 * data is thin (Phase 7 probe showed several dashboards would otherwise be
 * near-empty).
 */

// ─── shared time windows ─────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 sunday → 6 saturday
  const diff = day === 0 ? -6 : 1 - day; // shift to monday
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function isoWeekKey(d: Date): string {
  // ISO-ish: YYYY-W## based on the Monday of the week.
  const monday = startOfIsoWeek(d);
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const diff = (monday.getTime() - jan1.getTime()) / DAY_MS;
  const week = Math.floor(diff / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ─── 1. KPI strip ────────────────────────────────────────────────────────

export type DashboardKpis = {
  disponibilidadPct: number;
  maquinasTotales: number;
  maquinasActivas: number;
  mantPendientes: number;
  otEnCurso: number;
  facturacionMesTotal: number;
  facturacionMesCount: number;
  facturacionMesSerie: { mes: string; total: number }[];
  mantenimientosUltimos90d: number;
};

export async function loadKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const twelveAgoStart = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1,
  );
  const ninetyAgo = daysAgo(90);

  const [
    maquinasActivas,
    maquinasTotales,
    mantPendientes,
    otEnCurso,
    facturasMes,
    facturasSerie,
    mantenimientos90d,
  ] = await Promise.all([
    prisma.maquinaria.count({ where: { estado: "activo" } }),
    prisma.maquinaria.count(),
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
    prisma.mantenimiento.count({ where: { fechaCreacion: { gte: ninetyAgo } } }),
  ]);

  const serieMap = new Map(facturasSerie.map((r) => [r.mes, r.total]));
  const serie: { mes: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    serie.push({ mes: key, total: serieMap.get(key) ?? 0 });
  }

  const disponibilidadPct =
    maquinasTotales > 0 ? (maquinasActivas / maquinasTotales) * 100 : 0;

  return {
    disponibilidadPct,
    maquinasTotales,
    maquinasActivas,
    mantPendientes,
    otEnCurso,
    facturacionMesTotal: facturasMes._sum.total ?? 0,
    facturacionMesCount: facturasMes._count,
    facturacionMesSerie: serie,
    mantenimientosUltimos90d: mantenimientos90d,
  };
}

// ─── 2. Mezcla de OT (Donut) ─────────────────────────────────────────────

export type MezclaOtBucket = {
  tipo: string;
  count: number;
};

export async function loadMezclaOt(): Promise<MezclaOtBucket[]> {
  const since = daysAgo(90);
  const grouped = await prisma.mantenimiento.groupBy({
    by: ["tipo"],
    _count: { _all: true },
    where: { fechaCreacion: { gte: since } },
  });
  return grouped.map((g) => ({ tipo: g.tipo, count: g._count._all }));
}

// ─── 3. Repuestos consumidos (HorizontalBars mini) ───────────────────────

export type RepuestoConsumido = {
  itemId: number;
  codigo: string | null;
  descripcion: string | null;
  costoTotal: number;
  cantidad: number;
};

export async function loadRepuestosConsumidos(
  limit = 6,
): Promise<RepuestoConsumido[]> {
  const since = daysAgo(90);
  const grouped = await prisma.mantenimientoInsumo.groupBy({
    by: ["itemInventarioId"],
    _sum: { costoTotal: true, cantidadUtilizada: true },
    where: {
      mantenimiento: { fechaCreacion: { gte: since } },
    },
    orderBy: { _sum: { costoTotal: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const items = await prisma.inventario.findMany({
    where: { id: { in: grouped.map((g) => g.itemInventarioId) } },
    select: { id: true, codigo: true, descripcion: true },
  });
  const byId = new Map(items.map((it) => [it.id, it]));

  return grouped.map((g) => {
    const item = byId.get(g.itemInventarioId);
    return {
      itemId: g.itemInventarioId,
      codigo: item?.codigo ?? null,
      descripcion: item?.descripcion ?? null,
      costoTotal: g._sum.costoTotal ?? 0,
      cantidad: g._sum.cantidadUtilizada ?? 0,
    };
  });
}

// ─── 4. Backlog por máquina (HorizontalBars) ─────────────────────────────

export type BacklogRow = {
  maquinariaId: number;
  label: string;
  pendientes: number;
};

export async function loadBacklogPorMaquina(
  limit = 10,
): Promise<BacklogRow[]> {
  const grouped = await prisma.mantenimiento.groupBy({
    by: ["maquinariaId"],
    where: { estado: { in: ["Pendiente", "En Proceso"] } },
    _count: { _all: true },
    orderBy: { _count: { maquinariaId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const maquinas = await prisma.maquinaria.findMany({
    where: { id: { in: grouped.map((g) => g.maquinariaId) } },
    select: { id: true, nroSerie: true, tipo: { select: { nombre: true } } },
  });
  const byId = new Map(maquinas.map((m) => [m.id, m]));

  return grouped.map((g) => {
    const m = byId.get(g.maquinariaId);
    const tipo = m?.tipo?.nombre ?? "";
    const serie = m?.nroSerie ?? `#${g.maquinariaId}`;
    const label = tipo ? `${serie} · ${tipo}` : serie;
    return {
      maquinariaId: g.maquinariaId,
      label,
      pendientes: g._count._all,
    };
  });
}

// ─── 5. OTIF proveedores (HorizontalBars + objective) ────────────────────
//
// OTIF-ish: for OCs emitted in the last 90 days, how much of the requested
// quantity was actually received? Full OTIF would also require fechaPromesa,
// which legacy doesn't track, so this is effectively the "completeness" leg
// of OTIF — good enough to spot proveedores that chronically under-deliver.

export type OtifRow = {
  proveedorId: number;
  nombre: string;
  pct: number;
  solicitado: number;
  recibido: number;
};

export async function loadOtifProveedores(limit = 6): Promise<OtifRow[]> {
  const since = daysAgo(90);
  const rows = await prisma.$queryRaw<
    {
      proveedor_id: number;
      nombre: string;
      solicitado: number;
      recibido: number;
    }[]
  >`
    SELECT
      oc.proveedor_id,
      p.nombre,
      COALESCE(SUM(ocd.cantidad_solicitada), 0)::float as solicitado,
      COALESCE(SUM(ocd.cantidad_recibida), 0)::float as recibido
    FROM ordenes_compra oc
    JOIN proveedores p ON p.id = oc.proveedor_id
    JOIN ordenes_compra_detalle ocd ON ocd.oc_id = oc.id
    WHERE oc.fecha_emision >= ${since}
      AND oc.estado <> 'Cancelada'
    GROUP BY oc.proveedor_id, p.nombre
    HAVING COALESCE(SUM(ocd.cantidad_solicitada), 0) > 0
    ORDER BY COALESCE(SUM(ocd.cantidad_recibida), 0) / NULLIF(COALESCE(SUM(ocd.cantidad_solicitada), 0), 0) DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    proveedorId: r.proveedor_id,
    nombre: r.nombre,
    solicitado: r.solicitado,
    recibido: r.recibido,
    pct:
      r.solicitado > 0
        ? Math.min(100, (r.recibido / r.solicitado) * 100)
        : 0,
  }));
}

// ─── 6. Productividad técnicos (HorizontalBars) ──────────────────────────

export type TecnicoRow = {
  responsableId: number;
  nombre: string;
  mantenimientos: number;
};

export async function loadProductividadTecnicos(
  limit = 6,
): Promise<TecnicoRow[]> {
  const since = daysAgo(90);
  const grouped = await prisma.mantenimiento.groupBy({
    by: ["responsableId"],
    where: { fechaCreacion: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { responsableId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: grouped.map((g) => g.responsableId) } },
    select: { id: true, nombre: true, email: true },
  });
  const byId = new Map(usuarios.map((u) => [u.id, u]));

  return grouped.map((g) => {
    const u = byId.get(g.responsableId);
    return {
      responsableId: g.responsableId,
      nombre: u?.nombre ?? u?.email ?? `#${g.responsableId}`,
      mantenimientos: g._count._all,
    };
  });
}

// ─── 7. Disponibilidad & horas taller (dual-axis) ────────────────────────
//
// Legacy `estado='activo'` is monolithic (no history of state changes), so a
// true disponibilidad % time-series isn't reconstructable. We substitute:
//   • bars: mantenimientos creados/mes (proxy for carga de taller)
//   • line: gasto/mes (ARS) — already computed for KPI serie
// The chart title is reworded to "Carga de taller & gasto" on screen.

export type TallerTrendPoint = {
  mes: string;
  mantenimientos: number;
  gasto: number;
};

export async function loadTallerTrend(): Promise<TallerTrendPoint[]> {
  const now = new Date();
  const twelveAgoStart = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1,
  );
  const [mant, facturas] = await Promise.all([
    prisma.$queryRaw<{ mes: string; count: number }[]>`
      SELECT to_char(date_trunc('month', fecha_creacion), 'YYYY-MM') as mes,
             COUNT(*)::int as count
      FROM mantenimientos
      WHERE fecha_creacion >= ${twelveAgoStart}
      GROUP BY mes
      ORDER BY mes ASC
    `,
    prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(date_trunc('month', fecha_factura), 'YYYY-MM') as mes,
             COALESCE(SUM(total), 0)::float as total
      FROM facturas
      WHERE fecha_factura >= ${twelveAgoStart}
      GROUP BY mes
      ORDER BY mes ASC
    `,
  ]);

  const mantMap = new Map(mant.map((r) => [r.mes, Number(r.count)]));
  const factMap = new Map(facturas.map((r) => [r.mes, r.total]));
  const out: TallerTrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      mes: key,
      mantenimientos: mantMap.get(key) ?? 0,
      gasto: factMap.get(key) ?? 0,
    });
  }
  return out;
}

// ─── 8. Gasto por rubro (StackedBars) ────────────────────────────────────
//
// Gasto mensual segmentado por `inventario.categoria`. We trace:
//   facturas → factura_detalle → recepciones_detalle → ordenes_compra_detalle
//            → requisiciones_detalle → inventario.categoria
// Categories with no consumo roll into "Otros". We keep the top N
// categories by total and bucket the rest under "Otros" so the stack stays
// readable.

export type GastoRubroGroup = {
  mes: string;
  segments: { key: string; value: number }[];
};

export type GastoRubroResult = {
  data: GastoRubroGroup[];
  order: string[];
};

export async function loadGastoPorRubro(
  months = 6,
  topCategorias = 3,
): Promise<GastoRubroResult> {
  const now = new Date();
  const since = new Date(
    now.getFullYear(),
    now.getMonth() - (months - 1),
    1,
  );

  const rows = await prisma.$queryRaw<
    { mes: string; categoria: string | null; total: number }[]
  >`
    SELECT
      to_char(date_trunc('month', f.fecha_factura), 'YYYY-MM') as mes,
      COALESCE(NULLIF(TRIM(inv.categoria), ''), 'Otros') as categoria,
      COALESCE(SUM(fd.total), 0)::float as total
    FROM facturas f
    JOIN factura_detalle fd ON fd.factura_id = f.id
    JOIN recepciones_detalle rd ON rd.id = fd.recepcion_detalle_id
    JOIN ordenes_compra_detalle ocd ON ocd.id = rd.oc_detalle_id
    JOIN requisiciones_detalle reqd ON reqd.id = ocd.requisicion_detalle_id
    JOIN inventario inv ON inv.id = reqd.item_id
    WHERE f.fecha_factura >= ${since}
    GROUP BY mes, categoria
    ORDER BY mes ASC
  `;

  if (rows.length === 0) return { data: [], order: [] };

  // Rank categorías globally; bucket tail into "Otros".
  const catTotals = new Map<string, number>();
  for (const r of rows) {
    const key = r.categoria ?? "Otros";
    catTotals.set(key, (catTotals.get(key) ?? 0) + r.total);
  }
  const rankedAll = [...catTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topKeys = rankedAll.slice(0, topCategorias).map(([k]) => k);
  const hasOverflow = rankedAll.length > topCategorias;
  const order = [...topKeys, ...(hasOverflow ? ["Otros"] : [])];

  // Pivot into per-month groups, collapsing tail into "Otros".
  const byMes = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const cat = r.categoria ?? "Otros";
    const bucket = topKeys.includes(cat) ? cat : "Otros";
    if (!byMes.has(r.mes)) byMes.set(r.mes, new Map());
    const m = byMes.get(r.mes)!;
    m.set(bucket, (m.get(bucket) ?? 0) + r.total);
  }

  // Fill each of the last `months` months with zeros for missing buckets.
  const data: GastoRubroGroup[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMes.get(key) ?? new Map<string, number>();
    data.push({
      mes: key,
      segments: order.map((k) => ({ key: k, value: bucket.get(k) ?? 0 })),
    });
  }

  return { data, order };
}

// ─── 9. Heatmap horas parada ─────────────────────────────────────────────
//
// Legacy doesn't track downtime in hours. Best available proxy:
// mantenimientos correctivos per máquina × semana. We use correctivo count
// (density of incidents) as the heatmap value; label the scale accordingly.

export type HeatmapCell = { row: string; col: string; value: number };
export type HeatmapData = {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
};

export async function loadHorasParadaHeatmap(
  weeks = 12,
  topMachines = 5,
): Promise<HeatmapData> {
  const since = daysAgo(weeks * 7);

  // 1) Top máquinas by correctivo count in the window.
  const top = await prisma.mantenimiento.groupBy({
    by: ["maquinariaId"],
    where: {
      fechaCreacion: { gte: since },
      tipo: "correctivo",
    },
    _count: { _all: true },
    orderBy: { _count: { maquinariaId: "desc" } },
    take: topMachines,
  });
  if (top.length === 0) {
    return { rows: [], cols: [], cells: [] };
  }
  const maquinas = await prisma.maquinaria.findMany({
    where: { id: { in: top.map((t) => t.maquinariaId) } },
    select: { id: true, nroSerie: true },
  });
  const labelById = new Map(
    maquinas.map((m) => [m.id, m.nroSerie ?? `#${m.id}`]),
  );

  // 2) Build week column keys (last `weeks` mondays, oldest → newest).
  const now = new Date();
  const cols: string[] = [];
  const mondayKeys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * DAY_MS);
    const key = isoWeekKey(d);
    mondayKeys.push(key);
    cols.push(`s${key.slice(-2)}`);
  }

  // 3) Per-row mantenimientos fetched and grouped in JS; small data set.
  const mants = await prisma.mantenimiento.findMany({
    where: {
      fechaCreacion: { gte: since },
      tipo: "correctivo",
      maquinariaId: { in: top.map((t) => t.maquinariaId) },
    },
    select: { maquinariaId: true, fechaCreacion: true },
  });

  const counts = new Map<string, number>();
  for (const m of mants) {
    const k = `${m.maquinariaId}|${isoWeekKey(m.fechaCreacion)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const rows = top.map((t) => labelById.get(t.maquinariaId)!);
  const cells: HeatmapCell[] = [];
  for (const t of top) {
    const rowLabel = labelById.get(t.maquinariaId)!;
    mondayKeys.forEach((weekKey, i) => {
      cells.push({
        row: rowLabel,
        col: cols[i]!,
        value: counts.get(`${t.maquinariaId}|${weekKey}`) ?? 0,
      });
    });
  }

  return { rows, cols, cells };
}
