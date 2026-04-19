export type OcActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "not_found"
        | "wrong_estado"
        | "has_recepciones"
        | "unknown";
    };
