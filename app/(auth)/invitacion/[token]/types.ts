export type SetPasswordResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "expired" | "validation" | "unknown";
      fieldErrors?: Record<string, string>;
    };
