export function formatCurrencyARS(n: number, fractionDigits = 0) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatCurrencyShort(n: number) {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function formatNumber(n: number, digits = 1) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatMonthShort(ymKey: string) {
  const [y, m] = ymKey.split("-").map((s) => Number(s));
  if (!y || !m) return ymKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("es-AR", { month: "short" });
}

export function formatMonthYear(ymKey: string) {
  const [y, m] = ymKey.split("-").map((s) => Number(s));
  if (!y || !m) return ymKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("es-AR", { month: "short", year: "2-digit" });
}
