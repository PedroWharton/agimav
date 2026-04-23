"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

import type { SaveColumnsResult } from "./types";

const BUILTIN_KEYS = [
  "es_principal",
  "nro_serie",
  "estado",
  "horas_acumuladas",
  "created_at",
] as const;

const columnSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("builtin"),
    builtinKey: z.enum(BUILTIN_KEYS),
    visible: z.boolean(),
  }),
  z.object({
    kind: z.literal("attribute"),
    attributeId: z.coerce.number().int().positive(),
    visible: z.boolean(),
  }),
]);

const payloadSchema = z.object({
  tipoId: z.coerce.number().int().positive(),
  columns: z.array(columnSchema).max(200),
});

export async function saveColumnConfig(
  raw: unknown,
): Promise<SaveColumnsResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.columnas.configure");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { tipoId, columns } = parsed.data;

  try {
    const rows = columns.map((c, i) => ({
      tipoId,
      targetDepth: 0,
      orderIndex: i,
      columnKind: c.kind,
      builtinKey: c.kind === "builtin" ? c.builtinKey : null,
      attributeId: c.kind === "attribute" ? c.attributeId : null,
      visible: c.visible,
    }));
    await prisma.$transaction(async (tx) => {
      await tx.tablaConfig.deleteMany({ where: { tipoId } });
      if (rows.length > 0) await tx.tablaConfig.createMany({ data: rows });
    });
    revalidatePath(`/maquinaria/${tipoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[saveColumnConfig] failed", err);
    return { ok: false, error: "unknown" };
  }
}
