"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission, userIdFromSession } from "@/lib/rbac";
import type { Session } from "next-auth";

export type ServicioActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ServicioTarget =
  | { kind: "mantenimiento"; id: number }
  | { kind: "ot"; id: number };

const servicioSchema = z.object({
  proveedorServicioId: z
    .number({ message: "Elegí un proveedor de servicio" })
    .int()
    .positive("Elegí un proveedor de servicio"),
  descripcion: z.string().trim().min(1, "Obligatorio").max(500),
  costo: z.number().min(0, "No puede ser negativo").max(1e12),
  precioPendiente: z.boolean(),
  fecha: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

function canManage(session: Session | null, target: ServicioTarget): boolean {
  return hasPermission(
    session,
    target.kind === "mantenimiento" ? "mantenimiento.update" : "ot.update",
  );
}

function revalidateTarget(target: ServicioTarget) {
  revalidatePath(
    target.kind === "mantenimiento"
      ? `/mantenimiento/${target.id}`
      : `/ordenes-trabajo/${target.id}`,
  );
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function agregarServicioExterno(
  target: ServicioTarget,
  raw: unknown,
): Promise<ServicioActionResult> {
  const session = await auth();
  if (!canManage(session, target)) return { ok: false, error: "forbidden" };

  const parsed = servicioSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { fecha, ...rest } = parsed.data;

  try {
    await prisma.servicioExterno.create({
      data: {
        ...rest,
        fecha: fecha ? new Date(fecha) : null,
        mantenimientoId: target.kind === "mantenimiento" ? target.id : null,
        otId: target.kind === "ot" ? target.id : null,
        createdById: userIdFromSession(session),
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidateTarget(target);
  return { ok: true };
}

export async function actualizarServicioExterno(
  servicioId: number,
  raw: unknown,
): Promise<ServicioActionResult> {
  const session = await auth();

  const existing = await prisma.servicioExterno.findUnique({
    where: { id: servicioId },
    select: { mantenimientoId: true, otId: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const target = targetOf(existing);
  if (!target || !canManage(session, target)) {
    return { ok: false, error: "forbidden" };
  }

  const parsed = servicioSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { fecha, ...rest } = parsed.data;

  try {
    await prisma.servicioExterno.update({
      where: { id: servicioId },
      data: { ...rest, fecha: fecha ? new Date(fecha) : null },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidateTarget(target);
  return { ok: true };
}

export async function eliminarServicioExterno(
  servicioId: number,
): Promise<ServicioActionResult> {
  const session = await auth();

  const existing = await prisma.servicioExterno.findUnique({
    where: { id: servicioId },
    select: { mantenimientoId: true, otId: true },
  });
  if (!existing) return { ok: false, error: "not_found" };

  const target = targetOf(existing);
  if (!target || !canManage(session, target)) {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.servicioExterno.delete({ where: { id: servicioId } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidateTarget(target);
  return { ok: true };
}

function targetOf(row: {
  mantenimientoId: number | null;
  otId: number | null;
}): ServicioTarget | null {
  if (row.mantenimientoId != null)
    return { kind: "mantenimiento", id: row.mantenimientoId };
  if (row.otId != null) return { kind: "ot", id: row.otId };
  return null;
}
