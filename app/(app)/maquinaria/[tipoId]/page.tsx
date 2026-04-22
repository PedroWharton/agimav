import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  MaquinariaClient,
  type AtributoDef,
  type NivelDef,
  type MaquinaRow,
  type TipoOption,
  type RefSources,
  type ColumnConfigItem,
  type BuiltinColumnKey,
} from "./maquinaria-client";

export default async function MaquinariaTipoPage({
  params,
}: {
  params: Promise<{ tipoId: string }>;
}) {
  const session = await auth();
  const admin = isAdmin(session);

  const { tipoId: tipoIdParam } = await params;
  const tipoId = Number.parseInt(tipoIdParam, 10);
  if (!Number.isFinite(tipoId)) notFound();

  const [tipo, tiposActivos] = await Promise.all([
    prisma.maquinariaTipo.findUnique({
      where: { id: tipoId },
      include: {
        niveles: {
          where: { activo: true },
          include: {
            atributos: {
              orderBy: { id: "asc" },
            },
          },
          orderBy: [{ orden: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.maquinariaTipo.findMany({
      where: { estado: "activo" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!tipo) notFound();

  const [maquinas, tablaConfigRows] = await Promise.all([
    prisma.maquinaria.findMany({
      where: { typeId: tipoId },
      include: {
        nodos: {
          select: {
            id: true,
            nivelDefId: true,
            atributos: {
              select: {
                atributoDefId: true,
                valueText: true,
                valueNum: true,
                valueDate: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    }),
    prisma.tablaConfig.findMany({
      where: { tipoId },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  const BUILTIN_SET = new Set([
    "es_principal",
    "nro_serie",
    "estado",
    "horas_acumuladas",
    "created_at",
  ]);
  const BUILTIN_ALIASES: Record<string, string> = {
    horas_acumuladas: "horas_acumuladas",
    horasAcumuladas: "horas_acumuladas",
    estado: "estado",
    nro_serie: "nro_serie",
    nroSerie: "nro_serie",
    created_at: "created_at",
    createdAt: "created_at",
    es_principal: "es_principal",
    esPrincipal: "es_principal",
  };

  const columnConfig: ColumnConfigItem[] = [];
  for (const r of tablaConfigRows) {
    if (r.columnKind === "builtin" && r.builtinKey) {
      const canonical = BUILTIN_ALIASES[r.builtinKey];
      if (canonical && BUILTIN_SET.has(canonical)) {
        columnConfig.push({
          kind: "builtin",
          builtinKey: canonical as BuiltinColumnKey,
          visible: r.visible,
        });
      }
    } else if (r.columnKind === "attribute" && r.attributeId != null) {
      columnConfig.push({
        kind: "attribute",
        attributeId: r.attributeId,
        visible: r.visible,
      });
    }
  }

  const niveles: NivelDef[] = tipo.niveles.map((n) => ({
    id: n.id,
    nombre: n.nombre,
    parentLevelId: n.parentLevelId,
    orden: n.orden,
    atributos: n.atributos.map<AtributoDef>((a) => ({
      id: a.id,
      nombre: a.nombre,
      dataType: a.dataType,
      requerido: a.requerido,
      esPrincipal: a.esPrincipal,
      sourceRef: a.sourceRef,
      listOptions: a.listOptions,
      activo: a.activo,
    })),
  }));

  const rows: MaquinaRow[] = maquinas.map((m) => {
    const byNivel: MaquinaRow["niveles"] = [];
    const values: Record<number, string> = {};
    for (const n of m.nodos) {
      const atributos = n.atributos.map((a) => {
        const val =
          a.valueText ??
          (a.valueNum != null ? String(a.valueNum) : null) ??
          (a.valueDate ? a.valueDate.toISOString().slice(0, 10) : "");
        return { atributoId: a.atributoDefId, valueText: val ?? "" };
      });
      for (const a of atributos) values[a.atributoId] = a.valueText;
      byNivel.push({ nivelId: n.nivelDefId, atributos });
    }
    return {
      id: m.id,
      nroSerie: m.nroSerie,
      estado: m.estado,
      horasAcumuladas: m.horasAcumuladas,
      createdAt: m.createdAt.toISOString(),
      values,
      niveles: byNivel,
    };
  });

  const [unidades, inventario] = await Promise.all([
    prisma.unidadProductiva.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.inventario.findMany({
      select: { codigo: true, descripcion: true },
      orderBy: [{ codigo: "asc" }],
    }),
  ]);

  const refs: RefSources = {
    unidades_productivas: unidades
      .map((u) => u.nombre)
      .filter((n): n is string => !!n),
    inventario: inventario
      .map((i) => {
        const code = i.codigo ?? "";
        const desc = i.descripcion ?? "";
        const label = [code, desc].filter(Boolean).join(" — ");
        return label;
      })
      .filter((s) => s.length > 0),
  };

  const tiposOptions: TipoOption[] = tiposActivos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <MaquinariaClient
        admin={admin}
        tipo={{
          id: tipo.id,
          nombre: tipo.nombre,
          unidadMedicion: tipo.unidadMedicion,
          abrevUnidad: tipo.abrevUnidad,
        }}
        tipos={tiposOptions}
        niveles={niveles}
        rows={rows}
        refs={refs}
        columnConfig={columnConfig}
      />
    </div>
  );
}
