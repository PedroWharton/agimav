"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

import type { AtributoActionResult } from "./types";

const dataTypeSchema = z.enum(["text", "number", "date", "list", "ref"]);
const sourceRefSchema = z.enum(["unidades_productivas", "inventario"]);

const createSchema = z
  .object({
    nivelId: z.coerce.number().int().positive(),
    nombre: z.string().trim().min(1, "Obligatorio").max(120),
    dataType: dataTypeSchema,
    requerido: z.boolean().default(false),
    listOptions: z
      .union([z.string().trim().max(2000), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    sourceRef: z
      .union([sourceRefSchema, z.null()])
      .optional()
      .transform((v) => (v == null ? null : v)),
  })
  .superRefine((v, ctx) => {
    if (v.dataType === "list" && !v.listOptions) {
      ctx.addIssue({
        code: "custom",
        path: ["listOptions"],
        message: "Indicá las opciones separadas por coma",
      });
    }
    if (v.dataType === "ref" && !v.sourceRef) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Seleccioná un origen",
      });
    }
  });

const updateSchema = z
  .object({
    nombre: z.string().trim().min(1, "Obligatorio").max(120),
    requerido: z.boolean(),
    listOptions: z
      .union([z.string().trim().max(2000), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    sourceRef: z
      .union([sourceRefSchema, z.null()])
      .optional()
      .transform((v) => (v == null ? null : v)),
  });

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function revalidateForNivel(nivelId: number) {
  const nivel = await prisma.tipoNivel.findUnique({
    where: { id: nivelId },
    select: { tipoId: true },
  });
  if (nivel) {
    revalidatePath(`/maquinaria/tipos/${nivel.tipoId}/estructura`);
    revalidatePath(`/maquinaria/${nivel.tipoId}`);
  }
}

export async function createNivelAtributo(
  raw: unknown,
): Promise<AtributoActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    const created = await prisma.nivelAtributo.create({
      data: {
        nivelId: data.nivelId,
        nombre: data.nombre,
        dataType: data.dataType,
        requerido: data.requerido,
        listOptions: data.dataType === "list" ? data.listOptions : null,
        sourceRef: data.dataType === "ref" ? data.sourceRef : null,
        esPrincipal: false,
        activo: true,
      },
      select: { id: true },
    });
    await revalidateForNivel(data.nivelId);
    return { ok: true, id: created.id };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return {
        ok: false,
        error: "duplicate",
        fieldErrors: { nombre: "Ya existe un atributo con ese nombre" },
      };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function updateNivelAtributo(
  id: number,
  raw: unknown,
): Promise<AtributoActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.nivelAtributo.findUnique({
    where: { id },
    select: { id: true, nivelId: true, dataType: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const data = parsed.data;

  if (existing.dataType === "list" && !data.listOptions) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: { listOptions: "Indicá las opciones separadas por coma" },
    };
  }
  if (existing.dataType === "ref" && !data.sourceRef) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: { sourceRef: "Seleccioná un origen" },
    };
  }

  try {
    await prisma.nivelAtributo.update({
      where: { id },
      data: {
        nombre: data.nombre,
        requerido: data.requerido,
        listOptions: existing.dataType === "list" ? data.listOptions : null,
        sourceRef: existing.dataType === "ref" ? data.sourceRef : null,
      },
    });
    await revalidateForNivel(existing.nivelId);
    return { ok: true, id };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return {
        ok: false,
        error: "duplicate",
        fieldErrors: { nombre: "Ya existe un atributo con ese nombre" },
      };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function setNivelAtributoActivo(
  id: number,
  activo: boolean,
): Promise<AtributoActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.nivelAtributo.findUnique({
    where: { id },
    select: { nivelId: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  try {
    await prisma.nivelAtributo.update({
      where: { id },
      data: { activo },
    });
    await revalidateForNivel(existing.nivelId);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function deleteNivelAtributo(
  id: number,
): Promise<AtributoActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "maquinaria.tipos.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const existing = await prisma.nivelAtributo.findUnique({
    where: { id },
    select: { nivelId: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const valorCount = await prisma.maquinaAtributoValor.count({
    where: { atributoDefId: id },
  });
  if (valorCount > 0) {
    return { ok: false, error: "in_use", usageCount: valorCount };
  }

  try {
    await prisma.nivelAtributo.delete({ where: { id } });
    await revalidateForNivel(existing.nivelId);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
