/**
 * Phase 7 reality-check probe for the Estadísticas module.
 *
 * Reports: data volumes and distributions relevant to KPI cards (A),
 * ABC inventory (B), USD price evolution (C), MTBF per máquina (D),
 * gasto por usuario (E).
 *
 * Usage: tsx --env-file=.env.local scripts/estadisticas-probe.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  section("Slice A — KPI card inputs");
  const [
    maquinasActivas,
    maquinasTotales,
    inventarioBajo,
    inventarioTotales,
    ocsAbiertas,
    ocsTotales,
    mantPendientes,
    otAbiertas,
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
  ]);
  console.log(`Máquinas: ${maquinasActivas} activas / ${maquinasTotales} totales`);
  console.log(
    `Inventario bajo stock mínimo: ${inventarioBajo[0]?.count ?? 0} / ${inventarioTotales} ítems`,
  );
  console.log(`OCs abiertas (Emitida/Parcial): ${ocsAbiertas} / ${ocsTotales} totales`);
  console.log(`Mantenimientos Pendientes: ${mantPendientes}`);
  console.log(`OT En Curso: ${otAbiertas}`);

  section("Slice A — monthly spend (facturas)");
  const facturasMes = await prisma.$queryRaw<
    { mes: string; total_ars: number; n_facturas: bigint }[]
  >`SELECT
      to_char(date_trunc('month', fecha_factura), 'YYYY-MM') as mes,
      SUM(COALESCE(total, 0))::float as total_ars,
      COUNT(*)::bigint as n_facturas
    FROM facturas
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 12`;
  console.log("Últimos 12 meses de facturas (ARS):");
  for (const row of facturasMes) {
    console.log(
      `  ${row.mes}: ${row.n_facturas} facturas, total ARS ${row.total_ars?.toLocaleString("es-AR") ?? 0}`,
    );
  }

  section("Slice B — inventory consumption data (salidas)");
  const salidas = await prisma.inventarioMovimiento.aggregate({
    where: { tipo: "salida" },
    _count: true,
    _sum: { cantidad: true },
  });
  console.log(
    `Total salidas: ${salidas._count} movimientos, ${salidas._sum.cantidad ?? 0} unidades`,
  );
  const salidasPorModulo = await prisma.inventarioMovimiento.groupBy({
    by: ["moduloOrigen"],
    where: { tipo: "salida" },
    _count: true,
  });
  console.log("Distribución por módulo de origen:");
  for (const g of salidasPorModulo) {
    console.log(`  ${g.moduloOrigen ?? "(null)"}: ${g._count}`);
  }

  const itemsConSalidas = await prisma.$queryRaw<
    { items_con_salidas: bigint; items_sin_salidas: bigint }[]
  >`SELECT
      COUNT(DISTINCT CASE WHEN im.id IS NOT NULL THEN i.id END)::bigint as items_con_salidas,
      COUNT(DISTINCT CASE WHEN im.id IS NULL THEN i.id END)::bigint as items_sin_salidas
    FROM inventario i
    LEFT JOIN inventario_movimientos im ON im.id_item = i.id AND im.tipo = 'salida'`;
  console.log(
    `Cobertura: ${itemsConSalidas[0]?.items_con_salidas ?? 0} ítems con al menos una salida, ${itemsConSalidas[0]?.items_sin_salidas ?? 0} sin movimiento`,
  );

  section("Slice C — USD / precios_historico");
  const dolarCount = await prisma.dolarCotizacion.count();
  const dolarRango = await prisma.$queryRaw<
    { min_fecha: string; max_fecha: string }[]
  >`SELECT
      MIN(to_char(make_date(anio, mes, 1), 'YYYY-MM')) as min_fecha,
      MAX(to_char(make_date(anio, mes, 1), 'YYYY-MM')) as max_fecha
    FROM dolar_cotizaciones`;
  console.log(
    `Dolar cotizaciones: ${dolarCount} filas, rango ${dolarRango[0]?.min_fecha} — ${dolarRango[0]?.max_fecha}`,
  );
  const preciosCount = await prisma.precioHistorico.count();
  const preciosFuente = await prisma.precioHistorico.groupBy({
    by: ["fuente"],
    _count: true,
  });
  console.log(`Precios históricos: ${preciosCount} filas`);
  for (const g of preciosFuente) {
    console.log(`  fuente=${g.fuente ?? "(null)"}: ${g._count}`);
  }
  const cobertura = await prisma.$queryRaw<
    { items_con_precio: bigint; items_con_gte_2: bigint }[]
  >`SELECT
      COUNT(DISTINCT item_id)::bigint as items_con_precio,
      COUNT(DISTINCT CASE WHEN cnt >= 2 THEN item_id END)::bigint as items_con_gte_2
    FROM (SELECT item_id, COUNT(*) as cnt FROM precios_historico GROUP BY item_id) t`;
  console.log(
    `Cobertura: ${cobertura[0]?.items_con_precio} ítems con ≥1 precio, ${cobertura[0]?.items_con_gte_2} con ≥2 (graficable)`,
  );

  section("Slice D — mantenimientos + MTBF inputs");
  const mantPorTipo = await prisma.mantenimiento.groupBy({
    by: ["tipo"],
    _count: true,
  });
  console.log("Mantenimientos por tipo:");
  for (const g of mantPorTipo) {
    console.log(`  ${g.tipo}: ${g._count}`);
  }
  const mantPorEstado = await prisma.mantenimiento.groupBy({
    by: ["estado"],
    _count: true,
  });
  console.log("Mantenimientos por estado:");
  for (const g of mantPorEstado) {
    console.log(`  ${g.estado}: ${g._count}`);
  }

  const mantPorMaquina = await prisma.$queryRaw<
    {
      maq_con_0: bigint;
      maq_con_1: bigint;
      maq_con_2plus: bigint;
      maq_con_3plus: bigint;
    }[]
  >`SELECT
      SUM(CASE WHEN cnt = 0 THEN 1 ELSE 0 END)::bigint as maq_con_0,
      SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END)::bigint as maq_con_1,
      SUM(CASE WHEN cnt >= 2 THEN 1 ELSE 0 END)::bigint as maq_con_2plus,
      SUM(CASE WHEN cnt >= 3 THEN 1 ELSE 0 END)::bigint as maq_con_3plus
    FROM (
      SELECT m.id, COUNT(mt.id) as cnt
      FROM maquinaria m
      LEFT JOIN mantenimientos mt ON mt.maquinaria_id = m.id AND mt.tipo = 'correctivo'
      GROUP BY m.id
    ) t`;
  console.log("Distribución correctivos por máquina:");
  console.log(`  0 mantenimientos: ${mantPorMaquina[0]?.maq_con_0 ?? 0}`);
  console.log(`  1 mantenimiento:  ${mantPorMaquina[0]?.maq_con_1 ?? 0}`);
  console.log(`  2+ (MTBF calc):   ${mantPorMaquina[0]?.maq_con_2plus ?? 0}`);
  console.log(`  3+ (MTBF robusto):${mantPorMaquina[0]?.maq_con_3plus ?? 0}`);

  section("Slice E — gasto por usuario (solicitante en facturas)");
  const facturasPorUsuario = await prisma.$queryRaw<
    { usuario: string | null; n_facturas: bigint; total_ars: number }[]
  >`SELECT usuario, COUNT(*)::bigint as n_facturas, SUM(COALESCE(total, 0))::float as total_ars
    FROM facturas
    GROUP BY usuario
    ORDER BY total_ars DESC NULLS LAST
    LIMIT 15`;
  console.log("Top usuarios por gasto en facturas (ARS, texto libre):");
  for (const row of facturasPorUsuario) {
    console.log(
      `  usuario="${row.usuario ?? "(null)"}": ${row.n_facturas} facturas, ${row.total_ars?.toLocaleString("es-AR") ?? 0} ARS`,
    );
  }

  section("Inventario estado — Slice A + D");
  const mantPorMes = await prisma.$queryRaw<
    { mes: string; n: bigint }[]
  >`SELECT to_char(date_trunc('month', fecha_creacion), 'YYYY-MM') as mes, COUNT(*)::bigint as n
    FROM mantenimientos
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 12`;
  console.log("Mantenimientos por mes (últimos 12):");
  for (const row of mantPorMes) {
    console.log(`  ${row.mes}: ${row.n}`);
  }

  section("Maquinaria estados");
  const maqPorEstado = await prisma.maquinaria.groupBy({
    by: ["estado"],
    _count: true,
  });
  for (const g of maqPorEstado) {
    console.log(`  ${g.estado}: ${g._count}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
