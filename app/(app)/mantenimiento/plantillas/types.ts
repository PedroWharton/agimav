export const FRECUENCIA_UNIDADES = ["horas", "dias", "meses"] as const;
export type FrecuenciaUnidad = (typeof FRECUENCIA_UNIDADES)[number];

export type PlantillaActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "in_use"
        | "duplicate"
        | "unknown";
      fieldErrors?: Record<string, string>;
    };
