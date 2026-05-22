export const TIPO_LINEA = ["consumible", "herramienta"] as const;
export type TipoLinea = (typeof TIPO_LINEA)[number];

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
