import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireViewOrRedirect } from "@/lib/rbac";

import {
  MovimientosClient,
  type MovimientoRow,
} from "./movimientos-client";

type Search = Record<string, string | string[] | undefined>;

function sparam(searchParams: Search, key: string): string | undefined {
  const v = searchParams[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");

  const params = await searchParams;
  const tipo = sparam(params, "tipo");
  const modulo = sparam(params, "modulo");
  const itemId = Number(sparam(params, "item") ?? "");
  const desde = parseDate(sparam(params, "desde"));
  const hasta = parseDate(sparam(params, "hasta"));

  const where = {
    ...(tipo && tipo !== "todos" ? { tipo } : {}),
    ...(modulo && modulo !== "todos"
      ? modulo === "sin_modulo"
        ? { moduloOrigen: null }
        : { moduloOrigen: modulo }
      : {}),
    ...(Number.isFinite(itemId) && itemId > 0 ? { idItem: itemId } : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: hasta } : {}),
          },
        }
      : {}),
  };

  const [movs, total, distinctModulos] = await Promise.all([
    prisma.inventarioMovimiento.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 500,
      select: {
        id: true,
        fecha: true,
        tipo: true,
        cantidad: true,
        valorUnitario: true,
        unidadMedida: true,
        moduloOrigen: true,
        idOrigen: true,
        motivo: true,
        usuario: true,
        idItem: true,
        item: { select: { codigo: true, descripcion: true } },
      },
    }),
    prisma.inventarioMovimiento.count({ where }),
    prisma.inventarioMovimiento.findMany({
      distinct: ["moduloOrigen"],
      select: { moduloOrigen: true },
    }),
  ]);

  const rows: MovimientoRow[] = movs.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: m.cantidad,
    valorUnitario: m.valorUnitario,
    unidadMedida: m.unidadMedida,
    moduloOrigen: m.moduloOrigen,
    idOrigen: m.idOrigen,
    motivo: m.motivo,
    usuario: m.usuario,
    itemId: m.idItem,
    itemCodigo: m.item?.codigo ?? null,
    itemDescripcion: m.item?.descripcion ?? null,
  }));

  const modulos = distinctModulos
    .map((m) => m.moduloOrigen)
    .filter((v): v is string => !!v)
    .sort();

  return (
    <MovimientosClient
      rows={rows}
      total={total}
      modulos={modulos}
      initialFilters={{
        tipo: tipo ?? "todos",
        modulo: modulo ?? "todos",
        itemId: Number.isFinite(itemId) && itemId > 0 ? String(itemId) : "",
        desde: sparam(params, "desde") ?? "",
        hasta: sparam(params, "hasta") ?? "",
      }}
    />
  );
}
