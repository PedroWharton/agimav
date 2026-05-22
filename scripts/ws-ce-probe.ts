/**
 * Fase 9 reality-check probe — WS-C (trabajo sin máquina) + WS-E (gasto por usuario).
 *
 * WS-C: shapes para servicios externos, rework de OT y movimientos diarios.
 * WS-E: confirma el caveat de facturas usuario='Sistema' y busca una fuente
 *       alternativa de atribución de gasto por usuario.
 *
 * Usage: tsx --env-file=.env.local scripts/ws-ce-probe.ts
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
  // ── WS-C · Órdenes de trabajo ───────────────────────────────────────────────
  section("WS-C — OrdenTrabajo");
  const otTotal = await prisma.ordenTrabajo.count();
  const otPorEstado = await prisma.ordenTrabajo.groupBy({
    by: ["estado"],
    _count: true,
  });
  const otPorPrioridad = await prisma.ordenTrabajo.groupBy({
    by: ["prioridad"],
    _count: true,
  });
  console.log(`OrdenTrabajo: ${otTotal} filas`);
  console.log("Por estado:");
  for (const g of otPorEstado) console.log(`  ${g.estado}: ${g._count}`);
  console.log("Por prioridad:");
  for (const g of otPorPrioridad) console.log(`  ${g.prioridad}: ${g._count}`);

  const otCobertura = await prisma.$queryRaw<
    {
      con_up: bigint;
      con_resp: bigint;
      con_solic: bigint;
      con_fin: bigint;
      con_desc: bigint;
    }[]
  >`SELECT
      COUNT(*) FILTER (WHERE unidad_productiva_id IS NOT NULL)::bigint as con_up,
      COUNT(*) FILTER (WHERE responsable_id IS NOT NULL)::bigint as con_resp,
      COUNT(*) FILTER (WHERE solicitante_id IS NOT NULL)::bigint as con_solic,
      COUNT(*) FILTER (WHERE fecha_finalizacion IS NOT NULL)::bigint as con_fin,
      COUNT(*) FILTER (WHERE descripcion_trabajo IS NOT NULL AND descripcion_trabajo <> '')::bigint as con_desc
    FROM ordenes_trabajo`;
  const c = otCobertura[0];
  console.log(
    `Cobertura: ${c?.con_up} con UP, ${c?.con_resp} con responsable, ${c?.con_solic} con solicitante, ${c?.con_fin} finalizadas, ${c?.con_desc} con descripción de trabajo`,
  );

  const otInsumoTotal = await prisma.otInsumo.count();
  const otConInsumos = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT ot_id)::bigint as n FROM ot_insumos`;
  const otInsumoPendiente = await prisma.otInsumo.count({
    where: { precioPendiente: true },
  });
  console.log(
    `OtInsumo: ${otInsumoTotal} líneas en ${otConInsumos[0]?.n} OTs distintas; ${otInsumoPendiente} con precio pendiente`,
  );

  // ── WS-C · Movimientos diarios ──────────────────────────────────────────────
  section("WS-C — MovimientoDiario (registro liviano)");
  const movTotal = await prisma.movimientoDiario.count();
  const movCobertura = await prisma.$queryRaw<
    {
      con_fecha: bigint;
      con_codigo: bigint;
      con_cantidad: bigint;
      con_monto: bigint;
      con_proveedor: bigint;
      con_factura: bigint;
      con_justif: bigint;
      con_up: bigint;
    }[]
  >`SELECT
      COUNT(*) FILTER (WHERE fecha IS NOT NULL)::bigint as con_fecha,
      COUNT(*) FILTER (WHERE codigo_item IS NOT NULL AND codigo_item <> '')::bigint as con_codigo,
      COUNT(*) FILTER (WHERE cantidad IS NOT NULL)::bigint as con_cantidad,
      COUNT(*) FILTER (WHERE monto IS NOT NULL AND monto <> 0)::bigint as con_monto,
      COUNT(*) FILTER (WHERE proveedor IS NOT NULL AND proveedor <> '')::bigint as con_proveedor,
      COUNT(*) FILTER (WHERE factura IS NOT NULL AND factura <> '')::bigint as con_factura,
      COUNT(*) FILTER (WHERE justificacion IS NOT NULL AND justificacion <> '')::bigint as con_justif,
      COUNT(*) FILTER (WHERE unidad_productiva_id IS NOT NULL)::bigint as con_up
    FROM movimientos_diarios`;
  const m = movCobertura[0];
  console.log(`MovimientoDiario: ${movTotal} filas`);
  console.log(
    `  con fecha=${m?.con_fecha} codigo_item=${m?.con_codigo} cantidad=${m?.con_cantidad} monto=${m?.con_monto}`,
  );
  console.log(
    `  con proveedor=${m?.con_proveedor} factura=${m?.con_factura} justificacion=${m?.con_justif} unidad_productiva_id=${m?.con_up}`,
  );

  const movFechaRango = await prisma.$queryRaw<
    { min_fecha: Date | null; max_fecha: Date | null }[]
  >`SELECT MIN(fecha) as min_fecha, MAX(fecha) as max_fecha FROM movimientos_diarios`;
  console.log(
    `  rango fecha: ${movFechaRango[0]?.min_fecha?.toISOString().slice(0, 10) ?? "—"} → ${movFechaRango[0]?.max_fecha?.toISOString().slice(0, 10) ?? "—"}`,
  );

  const movSector = await prisma.$queryRaw<
    { sector: string | null; n: bigint }[]
  >`SELECT sector, COUNT(*)::bigint as n FROM movimientos_diarios
    GROUP BY sector ORDER BY n DESC LIMIT 15`;
  console.log("  sectores (top 15):");
  for (const g of movSector)
    console.log(`    "${g.sector ?? "(null)"}": ${g.n}`);

  const movUsuario = await prisma.$queryRaw<
    { usuario: string | null; n: bigint }[]
  >`SELECT usuario, COUNT(*)::bigint as n FROM movimientos_diarios
    GROUP BY usuario ORDER BY n DESC LIMIT 15`;
  console.log("  usuarios (top 15):");
  for (const g of movUsuario)
    console.log(`    "${g.usuario ?? "(null)"}": ${g.n}`);

  // codigo_item que matchea inventario
  const movMatch = await prisma.$queryRaw<
    { con_match: bigint; sin_match: bigint }[]
  >`SELECT
      COUNT(*) FILTER (WHERE i.id IS NOT NULL)::bigint as con_match,
      COUNT(*) FILTER (WHERE i.id IS NULL AND md.codigo_item IS NOT NULL AND md.codigo_item <> '')::bigint as sin_match
    FROM movimientos_diarios md
    LEFT JOIN inventario i ON i.codigo = md.codigo_item`;
  console.log(
    `  codigo_item: ${movMatch[0]?.con_match} matchean un ítem de inventario, ${movMatch[0]?.sin_match} no matchean`,
  );

  // ── WS-C · Proveedores ──────────────────────────────────────────────────────
  section("WS-C — Proveedores (referencia para servicios externos)");
  const provTotal = await prisma.proveedor.count();
  const provIva = await prisma.proveedor.groupBy({
    by: ["condicionIva"],
    _count: true,
  });
  console.log(`Proveedores: ${provTotal} filas`);
  for (const g of provIva)
    console.log(`  condicionIva="${g.condicionIva ?? "(null)"}": ${g._count}`);

  // ── WS-E · Gasto por usuario ────────────────────────────────────────────────
  section("WS-E — Factura.usuario (caveat: legacy = 'Sistema')");
  const factPorUsuario = await prisma.$queryRaw<
    { usuario: string | null; n: bigint; total: number }[]
  >`SELECT usuario, COUNT(*)::bigint as n, SUM(COALESCE(total,0))::float as total
    FROM facturas GROUP BY usuario ORDER BY total DESC NULLS LAST`;
  for (const r of factPorUsuario)
    console.log(
      `  usuario="${r.usuario ?? "(null)"}": ${r.n} facturas, ${r.total?.toLocaleString("es-AR") ?? 0} ARS`,
    );

  section("WS-E — fuentes alternativas de atribución de gasto");
  const reqPorSolic = await prisma.$queryRaw<
    { solicitante: string | null; n: bigint }[]
  >`SELECT solicitante, COUNT(*)::bigint as n FROM requisiciones
    GROUP BY solicitante ORDER BY n DESC LIMIT 12`;
  console.log("Requisiciones por solicitante (texto libre):");
  for (const r of reqPorSolic)
    console.log(`  "${r.solicitante ?? "(null)"}": ${r.n}`);

  const ocPorComprador = await prisma.$queryRaw<
    { comprador: string | null; n: bigint; total: number }[]
  >`SELECT comprador, COUNT(*)::bigint as n, SUM(COALESCE(total_estimado,0))::float as total
    FROM ordenes_compra GROUP BY comprador ORDER BY total DESC NULLS LAST LIMIT 12`;
  console.log("Órdenes de compra por comprador:");
  for (const r of ocPorComprador)
    console.log(
      `  "${r.comprador ?? "(null)"}": ${r.n} OCs, ${r.total?.toLocaleString("es-AR") ?? 0} ARS estimado`,
    );

  const mantPorCreador = await prisma.$queryRaw<
    { creado_por: string | null; n: bigint }[]
  >`SELECT creado_por, COUNT(*)::bigint as n FROM mantenimientos
    GROUP BY creado_por ORDER BY n DESC LIMIT 12`;
  console.log("Mantenimientos por creado_por:");
  for (const r of mantPorCreador)
    console.log(`  "${r.creado_por ?? "(null)"}": ${r.n}`);

  const otPorCreador = await prisma.$queryRaw<
    { creado_por: string | null; n: bigint }[]
  >`SELECT creado_por, COUNT(*)::bigint as n FROM ordenes_trabajo
    GROUP BY creado_por ORDER BY n DESC LIMIT 12`;
  console.log("OTs por creado_por:");
  for (const r of otPorCreador)
    console.log(`  "${r.creado_por ?? "(null)"}": ${r.n}`);
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
