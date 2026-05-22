import { prisma } from "@/lib/db";

/**
 * WS-B eliminó la tabla `localidades` como catálogo editable. `localidad` ahora
 * es texto plano en UnidadProductiva, Proveedor y OrdenTrabajo.
 *
 * Esta función deriva la lista de localidades conocidas uniendo los valores
 * distintos de texto que ya existen en esas tres entidades. Sirve para sembrar
 * los combobox de texto-libre (allowCreate) que reemplazaron al selector de FK
 * — el usuario elige una existente o tipea una nueva.
 */
export async function getLocalidadesSugeridas(): Promise<string[]> {
  const [ups, proveedores, ordenes] = await Promise.all([
    prisma.unidadProductiva.findMany({
      where: { localidad: { not: null } },
      select: { localidad: true },
      distinct: ["localidad"],
    }),
    prisma.proveedor.findMany({
      where: { localidad: { not: null } },
      select: { localidad: true },
      distinct: ["localidad"],
    }),
    prisma.ordenTrabajo.findMany({
      where: { localidad: { not: null } },
      select: { localidad: true },
      distinct: ["localidad"],
    }),
  ]);

  const set = new Set<string>();
  for (const row of [...ups, ...proveedores, ...ordenes]) {
    const value = row.localidad?.trim();
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}
