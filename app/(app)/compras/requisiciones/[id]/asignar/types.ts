export type AsignarActionResult =
  | { ok: true; id: number; ocIds?: number[] }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "wrong_estado"
        | "incomplete"
        | "unknown";
      message?: string;
    };
