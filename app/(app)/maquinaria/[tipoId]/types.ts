export type MaquinariaPayload = {
  tipoId: number;
  nroSerie: string | null;
  estado: string;
  horasAcumuladas: number;
  niveles: Array<{
    nivelId: number;
    atributos: Array<{ atributoId: number; valueText: string }>;
  }>;
};

export type ActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "unknown" | "in_use" | "not_found";
      fieldErrors?: Record<string, string>;
      usageCount?: number;
    };

export type BuiltinKey =
  | "es_principal"
  | "nro_serie"
  | "estado"
  | "horas_acumuladas"
  | "created_at";

export type ColumnPayload =
  | { kind: "builtin"; builtinKey: BuiltinKey; visible: boolean }
  | { kind: "attribute"; attributeId: number; visible: boolean };

export type SaveColumnsResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "unknown" };
