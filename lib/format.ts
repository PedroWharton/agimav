const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

export function formatARS(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return arsFormatter.format(n);
}

export function formatNumber(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return numberFormatter.format(n);
}

/** Round a float to 4 decimals to avoid IEEE-754 noise when persisting valor_unitario. */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
