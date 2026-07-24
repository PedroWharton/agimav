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

/** Estados en los que un mantenimiento puede crearse directamente
 * (todos menos Cancelado). */
export const MANT_ESTADOS_INICIALES: MantEstado[] = [
  "Pendiente",
  "En Reparación - Chacra",
  "En Reparación - Taller",
  "Finalizado",
];

/** Canonical reference for the "pendiente" state — used by queries that need
 * only the starting state, not the whole active set. */
export const MANT_ESTADO_PENDIENTE: MantEstado = "Pendiente";

export const MANT_ESTADO_I18N_KEY: Record<MantEstado, string> = {
  Pendiente: "Pendiente",
  "En Reparación - Chacra": "EnReparacionChacra",
  "En Reparación - Taller": "EnReparacionTaller",
  Finalizado: "Finalizado",
  Cancelado: "Cancelado",
};

export const MANT_TIPOS = ["correctivo", "preventivo", "revisión"] as const;
export type MantTipo = (typeof MANT_TIPOS)[number];

/** Una revisión es un mantenimiento recurrente: al finalizarlo vuelve a
 * Pendiente con la próxima fecha programada (mismo registro, no crea uno
 * nuevo). El intervalo se guarda en frecuenciaValor (días). */
export const MANT_TIPO_REVISION: MantTipo = "revisión";

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
  opts: { canCancel: boolean },
): MantTransition[] {
  const out: MantTransition[] = [];
  switch (estado) {
    case "Pendiente":
      out.push("iniciarChacra", "iniciarTaller");
      if (opts.canCancel) out.push("cancelar");
      break;
    case "En Reparación - Chacra":
      out.push("cambiarTaller", "finalizar");
      if (opts.canCancel) out.push("cancelar");
      break;
    case "En Reparación - Taller":
      out.push("cambiarTaller", "finalizar");
      if (opts.canCancel) out.push("cancelar");
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

/** Estado canónico de una revisión cumplida. Escrituras nuevas usan siempre
 * "hecha"; filas legacy en prod pueden traer "realizada" — para leer usá
 * `isRevisionHecha()`, que acepta ambas. */
export const REVISION_ESTADO_HECHA = "hecha";

export const REVISION_ESTADO_PENDIENTE = "pendiente";

export function isRevisionHecha(estado: string): boolean {
  return estado === "hecha" || estado === "realizada";
}

export const HISTORIAL_TIPOS = [
  "estado",
  "insumo",
  "taller",
  "responsable",
  "observacion",
] as const;
export type HistorialTipo = (typeof HISTORIAL_TIPOS)[number];
