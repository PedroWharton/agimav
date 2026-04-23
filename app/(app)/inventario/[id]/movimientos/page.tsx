import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireViewOrRedirect } from "@/lib/rbac";

import { PerItemMovimientosClient } from "./per-item-client";

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

export default async function PerItemMovimientosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  requireViewOrRedirect(session, "inventario.view");

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const sp = await searchParams;
  const tipo = sparam(sp, "tipo");
  const modulo = sparam(sp, "modulo");
  const desde = parseDate(sparam(sp, "desde"));
  const hasta = parseDate(sparam(sp, "hasta"));

  const item = await prisma.inventario.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      stock: true,
      stockMinimo: true,
      valorUnitario: true,
      unidadMedida: true,
    },
  });
  if (!item) notFound();

  const where = {
    idItem: id,
    ...(tipo && tipo !== "todos" ? { tipo } : {}),
    ...(modulo && modulo !== "todos"
      ? modulo === "sin_modulo"
        ? { moduloOrigen: null }
        : { moduloOrigen: modulo }
      : {}),
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
      },
    }),
    prisma.inventarioMovimiento.count({ where }),
    prisma.inventarioMovimiento.findMany({
      where: { idItem: id },
      distinct: ["moduloOrigen"],
      select: { moduloOrigen: true },
    }),
  ]);

  const modulos = distinctModulos
    .map((m) => m.moduloOrigen)
    .filter((v): v is string => !!v)
    .sort();

  return (
    <PerItemMovimientosClient
      item={{
        id: item.id,
        codigo: item.codigo ?? "",
        descripcion: item.descripcion ?? "",
        stock: item.stock,
        stockMinimo: item.stockMinimo,
        valorUnitario: item.valorUnitario,
        unidadMedida: item.unidadMedida,
      }}
      rows={movs}
      total={total}
      modulos={modulos}
      initialFilters={{
        tipo: tipo ?? "todos",
        modulo: modulo ?? "todos",
        desde: sparam(sp, "desde") ?? "",
        hasta: sparam(sp, "hasta") ?? "",
      }}
    />
  );
}
