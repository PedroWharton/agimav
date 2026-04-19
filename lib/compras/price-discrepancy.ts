export const PRICE_DISCREPANCY_SOFT = 0.005;
export const PRICE_DISCREPANCY_HARD = 0.1;

export type PriceDiscrepancy = "none" | "match" | "soft" | "hard" | "noReference";

export function classifyPriceDiscrepancy(
  ocPrice: number | null | undefined,
  facturaPrice: number | null | undefined,
): PriceDiscrepancy {
  if (!ocPrice || ocPrice <= 0) return "noReference";
  if (!facturaPrice || facturaPrice <= 0) return "none";
  const delta = Math.abs(facturaPrice - ocPrice) / ocPrice;
  if (delta === 0) return "match";
  if (delta > PRICE_DISCREPANCY_HARD) return "hard";
  if (delta > PRICE_DISCREPANCY_SOFT) return "soft";
  return "match";
}
