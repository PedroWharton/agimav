export type RecepcionActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "wrong_estado"
        | "over_reception"
        | "nothing_to_receive"
        | "unknown";
      message?: string;
    };
