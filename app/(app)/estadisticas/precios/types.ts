export const PRECIOS_RANGES = ["90d", "ytd", "todo"] as const;
export type PreciosRange = (typeof PRECIOS_RANGES)[number];

export type PricePoint = {
  fecha: string; // ISO YYYY-MM-DD
  precioArs: number;
  precioUsd: number | null;
  proveedor: string | null;
};

export type PriceSeries = {
  itemId: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  points: PricePoint[];
  dolarFrom: string | null; // earliest month with a cotización, "YYYY-MM"
};
