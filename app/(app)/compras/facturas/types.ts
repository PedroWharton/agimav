export type FacturaActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "not_found"
        | "duplicate_numero"
        | "already_invoiced"
        | "wrong_proveedor"
        | "unknown";
      message?: string;
    };
