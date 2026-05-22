"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, userIdFromSession } from "@/lib/rbac";

import type { ActionResult } from "./types";

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const schema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  rubro: optionalString(120),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v == null || CUIT_REGEX.test(v), {
      message: "Formato: 30-12345678-9",
    }),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v == null || z.string().email().safeParse(v).success, {
      message: "Email inválido",
    }),
  telefono: optionalString(50),
  contacto: optionalString(200),
  observaciones: optionalString(500),
});

const MANAGE = "listados.proveedores.manage";

export async function createProveedorServicio(
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    await prisma.proveedorServicio.create({
      data: {
        ...parsed.data,
        estado: "activo",
        createdById: userIdFromSession(session),
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores-servicio");
  return { ok: true };
}

export async function updateProveedorServicio(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    await prisma.proveedorServicio.update({
      where: { id },
      data: { ...parsed.data },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores-servicio");
  return { ok: true };
}

export async function deactivateProveedorServicio(
  id: number,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.proveedorServicio.update({
      where: { id },
      data: { estado: "inactivo" },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores-servicio");
  return { ok: true };
}

export async function reactivateProveedorServicio(
  id: number,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requirePermission(session, MANAGE);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.proveedorServicio.update({
      where: { id },
      data: { estado: "activo" },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores-servicio");
  return { ok: true };
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
