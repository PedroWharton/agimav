"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";

const BUILTIN_KEYS = [
  "es_principal",
  "nro_serie",
  "estado",
  "horas_acumuladas",
  "created_at",
] as const;
export type BuiltinKey = (typeof BUILTIN_KEYS)[number];

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

export type ColumnPayload = z.infer<typeof columnSchema>;

export type SaveColumnsResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "unknown" };

export async function saveColumnConfig(
  raw: unknown,
): Promise<SaveColumnsResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { tipoId, columns } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tablaConfig.deleteMany({ where: { tipoId } });
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        await tx.tablaConfig.create({
          data: {
            tipoId,
            targetDepth: 0,
            orderIndex: i,
            columnKind: c.kind,
            builtinKey: c.kind === "builtin" ? c.builtinKey : null,
            attributeId: c.kind === "attribute" ? c.attributeId : null,
            visible: c.visible,
          },
        });
      }
    });
    revalidatePath(`/maquinaria/${tipoId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
