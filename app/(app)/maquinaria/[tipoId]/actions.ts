"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, userIdFromSession } from "@/lib/rbac";
import type { Prisma } from "@/lib/generated/prisma/client";

import type { ActionResult } from "./types";

const atributoSchema = z.object({
  atributoId: z.coerce.number().int().positive(),
  valueText: z.string().max(1000),
});

const nivelSchema = z.object({
  nivelId: z.coerce.number().int().positive(),
  atributos: z.array(atributoSchema),
});

const payloadSchema = z.object({
  tipoId: z.coerce.number().int().positive(),
  nroSerie: z
    .union([z.string().trim().max(120), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  estado: z.string().trim().min(1).max(40),
  horasAcumuladas: z.coerce.number().finite().min(0).default(0),
  niveles: z.array(nivelSchema),
});

export async function createMaquinaria(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const maquina = await tx.maquinaria.create({
        data: {
          typeId: data.tipoId,
          nroSerie: data.nroSerie,
          estado: data.estado,
          horasAcumuladas: data.horasAcumuladas,
          createdById: userIdFromSession(session),
        },
      });
      await upsertNodosAndValues(tx, maquina.id, data.niveles);
      return maquina.id;
    });
    revalidatePath(`/maquinaria/${data.tipoId}`);
    revalidatePath("/maquinaria");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function updateMaquinaria(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.maquinaria.findUnique({ where: { id } });
      if (!existing) throw new Error("not_found");
      if (existing.typeId !== data.tipoId) throw new Error("invalid");

      await tx.maquinaria.update({
        where: { id },
        data: {
          nroSerie: data.nroSerie,
          estado: data.estado,
          horasAcumuladas: data.horasAcumuladas,
        },
      });
      await upsertNodosAndValues(tx, id, data.niveles);
    });
    revalidatePath(`/maquinaria/${data.tipoId}`);
    revalidatePath("/maquinaria");
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Error && e.message === "not_found") {
      return { ok: false, error: "not_found" };
    }
    if (e instanceof Error && e.message === "invalid") {
      return { ok: false, error: "invalid" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteMaquinaria(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const maquina = await prisma.maquinaria.findUnique({
    where: { id },
    select: { typeId: true },
  });
  if (!maquina) return { ok: false, error: "not_found" };

  const mantCount = await prisma.mantenimiento.count({
    where: { maquinariaId: id },
  });
  if (mantCount > 0) {
    return { ok: false, error: "in_use", usageCount: mantCount };
  }

  try {
    await prisma.maquinaria.delete({ where: { id } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath(`/maquinaria/${maquina.typeId}`);
  revalidatePath("/maquinaria");
  return { ok: true, id };
}

async function upsertNodosAndValues(
  tx: Prisma.TransactionClient,
  maquinariaId: number,
  niveles: Array<{
    nivelId: number;
    atributos: Array<{ atributoId: number; valueText: string }>;
  }>,
) {
  const defs = await tx.tipoNivel.findMany({
    where: { id: { in: niveles.map((n) => n.nivelId) } },
    select: { id: true, parentLevelId: true },
  });
  const defById = new Map(defs.map((d) => [d.id, d]));

  const existingNodos = await tx.maquinaNodo.findMany({
    where: { maquinariaId },
    select: { id: true, nivelDefId: true, parentNodeId: true },
  });
  const existingByNivel = new Map(
    existingNodos.map((n) => [n.nivelDefId, n]),
  );

  // Insert roots first so children can reference them.
  const sorted = [...niveles].sort((a, b) => {
    const aRoot = defById.get(a.nivelId)?.parentLevelId == null ? 0 : 1;
    const bRoot = defById.get(b.nivelId)?.parentLevelId == null ? 0 : 1;
    return aRoot - bRoot;
  });

  const nodeByNivel = new Map<number, number>();

  for (const nivelPayload of sorted) {
    const def = defById.get(nivelPayload.nivelId);
    if (!def) continue;
    const parentNodeId =
      def.parentLevelId == null
        ? null
        : (nodeByNivel.get(def.parentLevelId) ?? null);

    const existing = existingByNivel.get(nivelPayload.nivelId);
    if (existing) {
      nodeByNivel.set(nivelPayload.nivelId, existing.id);
      if (existing.parentNodeId !== parentNodeId) {
        await tx.maquinaNodo.update({
          where: { id: existing.id },
          data: { parentNodeId },
        });
      }
    } else {
      const created = await tx.maquinaNodo.create({
        data: {
          maquinariaId,
          nivelDefId: nivelPayload.nivelId,
          parentNodeId,
          activo: true,
        },
        select: { id: true },
      });
      nodeByNivel.set(nivelPayload.nivelId, created.id);
    }
  }

  for (const nivelPayload of niveles) {
    const nodoId = nodeByNivel.get(nivelPayload.nivelId);
    if (!nodoId) continue;
    for (const a of nivelPayload.atributos) {
      const valueText = a.valueText.trim();
      if (valueText === "") {
        await tx.maquinaAtributoValor.deleteMany({
          where: { nodoId, atributoDefId: a.atributoId },
        });
      } else {
        await tx.maquinaAtributoValor.upsert({
          where: {
            nodoId_atributoDefId: { nodoId, atributoDefId: a.atributoId },
          },
          update: { valueText, lastUpdated: new Date() },
          create: {
            nodoId,
            atributoDefId: a.atributoId,
            valueText,
          },
        });
      }
    }
  }
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

