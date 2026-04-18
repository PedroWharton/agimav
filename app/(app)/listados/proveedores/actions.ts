"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin, userIdFromSession } from "@/lib/rbac";

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Monotributo",
  "Exento",
  "Consumidor Final",
  "No Responsable",
] as const;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const schema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(200),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v == null || CUIT_REGEX.test(v), {
      message: "Formato: 30-12345678-9",
    }),
  condicionIva: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v == null || (CONDICIONES_IVA as readonly string[]).includes(v),
      { message: "Condición IVA inválida" },
    ),
  localidadId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
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
  direccion: optionalString(300),
  direccionFiscal: optionalString(300),
  nombreContacto: optionalString(200),
  contacto: optionalString(200),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createProveedor(raw: unknown): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.proveedor.create({
      data: {
        ...parsed.data,
        localidadId: parsed.data.localidadId ?? null,
        estado: "activo",
        createdById: userIdFromSession(session),
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores");
  return { ok: true };
}

export async function updateProveedor(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await prisma.proveedor.update({
      where: { id },
      data: {
        ...parsed.data,
        localidadId: parsed.data.localidadId ?? null,
      },
    });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores");
  return { ok: true };
}

export async function deactivateProveedor(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.proveedor.update({ where: { id }, data: { estado: "inactivo" } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores");
  return { ok: true };
}

export async function reactivateProveedor(id: number): Promise<ActionResult> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.proveedor.update({ where: { id }, data: { estado: "activo" } });
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/listados/proveedores");
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

export { CONDICIONES_IVA };
