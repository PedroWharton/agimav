export const OT_ESTADOS = ["En Curso", "Cerrada", "Cancelada"] as const;
export type OtEstado = (typeof OT_ESTADOS)[number];

export const OT_PRIORIDADES = ["Baja", "Media", "Alta"] as const;
export type OtPrioridad = (typeof OT_PRIORIDADES)[number];

export function otIsActiva(estado: string): boolean {
  return estado === "En Curso";
}

export function otIsTerminal(estado: string): boolean {
  return estado === "Cerrada" || estado === "Cancelada";
}

export type OtActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "wrong_estado"
        | "stock_insuficiente"
        | "unknown";
      fieldErrors?: Record<string, string>;
    };
