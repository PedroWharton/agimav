export const ABC_RANGES = ["30d", "90d", "ytd", "todo"] as const;
export type AbcRange = (typeof ABC_RANGES)[number];

export type AbcRow = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  unidadMedida: string | null;
  cantidadConsumida: number;
  valorUnitario: number;
  valorConsumido: number;
  porcentaje: number;
  acumulado: number;
  clase: "A" | "B" | "C";
};

export type AbcResult = {
  rows: AbcRow[];
  valorTotal: number;
  sinConsumo: number;
  inventarioTotales: number;
  porClase: { a: number; b: number; c: number };
};

export type ExportResult = { base64: string; filename: string };
