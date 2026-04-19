export type RequisicionActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "unknown"
        | "not_found"
        | "wrong_estado"
        | "empty_detalle"
        | "motivo_required";
      fieldErrors?: Record<string, string>;
    };
