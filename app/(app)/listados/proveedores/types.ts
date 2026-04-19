export const CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Monotributo",
  "Exento",
  "Consumidor Final",
  "No Responsable",
] as const;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
