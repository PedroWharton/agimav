export const TIPO_ACTUALIZACION = ["manual", "importacion"] as const;
export type TipoActualizacion = (typeof TIPO_ACTUALIZACION)[number];

export type HorometroActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "horas_retroactivas"
        | "unknown";
      fieldErrors?: Record<string, string>;
    };
