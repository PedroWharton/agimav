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

export type EmitirOcsResult =
  | { ok: true; ocIds: number[] }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "nothing_selected"
        | "item_drained"
        | "cantidad_exceeds"
        | "unknown";
      message?: string;
    };
