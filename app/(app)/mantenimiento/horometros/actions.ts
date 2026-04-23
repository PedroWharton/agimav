"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  requirePermission,
  userNameFromSession,
} from "@/lib/rbac";

import { TIPO_ACTUALIZACION } from "./types";
import type { HorometroActionResult } from "./types";

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null)));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const createSchema = z.object({
  maquinariaId: z.coerce.number().int().positive(),
  horasNuevo: z.coerce.number().min(0),
  fechaRegistro: optionalDate,
  tipoActualizacion: z.enum(TIPO_ACTUALIZACION).default("manual"),
  observaciones: optionalText(500),
});

export async function createRegistroHoras(
  raw: unknown,
): Promise<HorometroActionResult> {
  const session = await auth();
  try {
    requirePermission(session, "mantenimiento.horas.register");
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
  const userName = userNameFromSession(session);

  const maquinaria = await prisma.maquinaria.findUnique({
    where: { id: data.maquinariaId },
    select: { id: true, horasAcumuladas: true },
  });
  if (!maquinaria) return { ok: false, error: "not_found" };

  const horasAnterior = maquinaria.horasAcumuladas;
  if (data.horasNuevo < horasAnterior) {
    return {
      ok: false,
      error: "horas_retroactivas",
      fieldErrors: {
        horasNuevo: `No puede ser menor a las horas actuales (${horasAnterior}).`,
      },
    };
  }

  const horasDiferencia = data.horasNuevo - horasAnterior;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const registro = await tx.registroHorasMaquinaria.create({
        data: {
          idMaquinaria: data.maquinariaId,
          fechaRegistro: data.fechaRegistro ?? new Date(),
          horasAnterior,
          horasNuevo: data.horasNuevo,
          horasDiferencia,
          tipoActualizacion: data.tipoActualizacion,
          observaciones: data.observaciones,
          usuario: userName,
        },
      });
      await tx.maquinaria.update({
        where: { id: data.maquinariaId },
        data: { horasAcumuladas: data.horasNuevo },
      });
      return registro.id;
    });
    revalidatePath("/mantenimiento/horometros");
    revalidatePath("/maquinaria");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
