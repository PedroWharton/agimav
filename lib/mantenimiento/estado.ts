export const MANT_ESTADOS = [
  "Pendiente",
  "En Reparación - Chacra",
  "En Reparación - Taller",
  "Finalizado",
  "Cancelado",
] as const;

export type MantEstado = (typeof MANT_ESTADOS)[number];

export const MANT_ESTADOS_ACTIVOS: MantEstado[] = [
  "Pendiente",
  "En Reparación - Chacra",
  "En Reparación - Taller",
];

export const MANT_ESTADOS_TERMINALES: MantEstado[] = [
  "Finalizado",
  "Cancelado",
];

export const MANT_ESTADO_I18N_KEY: Record<MantEstado, string> = {
  Pendiente: "Pendiente",
  "En Reparación - Chacra": "EnReparacionChacra",
  "En Reparación - Taller": "EnReparacionTaller",
  Finalizado: "Finalizado",
  Cancelado: "Cancelado",
};

export const MANT_TIPOS = ["correctivo", "preventivo"] as const;
export type MantTipo = (typeof MANT_TIPOS)[number];

export const MANT_PRIORIDADES = ["Baja", "Media", "Alta"] as const;
export type MantPrioridad = (typeof MANT_PRIORIDADES)[number];

export type MantTransition =
  | "iniciarChacra"
  | "iniciarTaller"
  | "cambiarTaller"
  | "finalizar"
  | "cancelar";

export function allowedTransitions(
  estado: string,
  opts: { isAdmin: boolean },
): MantTransition[] {
  const out: MantTransition[] = [];
  switch (estado) {
    case "Pendiente":
      out.push("iniciarChacra", "iniciarTaller");
      if (opts.isAdmin) out.push("cancelar");
      break;
    case "En Reparación - Chacra":
      out.push("cambiarTaller", "finalizar");
      if (opts.isAdmin) out.push("cancelar");
      break;
    case "En Reparación - Taller":
      out.push("cambiarTaller", "finalizar");
      if (opts.isAdmin) out.push("cancelar");
      break;
  }
  return out;
}

export function isTerminal(estado: string): boolean {
  return (MANT_ESTADOS_TERMINALES as string[]).includes(estado);
}

export function isActivo(estado: string): boolean {
  return (MANT_ESTADOS_ACTIVOS as string[]).includes(estado);
}

export const HISTORIAL_TIPOS = [
  "estado",
  "insumo",
  "taller",
  "responsable",
  "observacion",
] as const;
export type HistorialTipo = (typeof HISTORIAL_TIPOS)[number];
