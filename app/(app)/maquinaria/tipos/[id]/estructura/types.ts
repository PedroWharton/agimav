export type AtributoActionResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "unknown"
        | "duplicate"
        | "in_use"
        | "not_found";
      fieldErrors?: Record<string, string>;
      usageCount?: number;
    };
