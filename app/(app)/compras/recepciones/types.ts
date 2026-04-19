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

export type CerrarSinFacturaResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "already_closed"
        | "nothing_to_close"
        | "unknown";
      message?: string;
    };
