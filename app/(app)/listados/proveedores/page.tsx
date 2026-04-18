import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

import {
  ProveedoresClient,
  type ProveedorRow,
  type LocalidadOption,
} from "./proveedores-client";

export default async function ProveedoresPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const [proveedores, localidades] = await Promise.all([
    prisma.proveedor.findMany({
      select: {
        id: true,
        nombre: true,
        cuit: true,
        email: true,
        telefono: true,
        direccion: true,
        direccionFiscal: true,
        condicionIva: true,
        nombreContacto: true,
        contacto: true,
        estado: true,
        localidadId: true,
        localidad: { select: { nombre: true } },
        createdAt: true,
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.localidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rows: ProveedorRow[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    cuit: p.cuit ?? null,
    email: p.email ?? null,
    telefono: p.telefono ?? null,
    direccion: p.direccion ?? null,
    direccionFiscal: p.direccionFiscal ?? null,
    condicionIva: p.condicionIva ?? null,
    nombreContacto: p.nombreContacto ?? null,
    contacto: p.contacto ?? null,
    estado: p.estado,
    localidadId: p.localidadId ?? null,
    localidadNombre: p.localidad?.nombre ?? null,
    createdAt: p.createdAt,
  }));

  const localidadOptions: LocalidadOption[] = localidades.map((l) => ({
    id: l.id,
    nombre: l.nombre,
  }));

  return (
    <ProveedoresClient
      rows={rows}
      localidades={localidadOptions}
      isAdmin={admin}
    />
  );
}
