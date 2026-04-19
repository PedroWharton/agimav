export const PROV_RANGES = ["30d", "90d", "ytd", "todo"] as const;
export type ProvRange = (typeof PROV_RANGES)[number];

export type ProvRow = {
  id: number;
  nombre: string;
  facturas: number;
  total: number;
  porcentaje: number;
  ultima: Date | null;
};

export type ProvResult = {
  rows: ProvRow[];
  totalGeneral: number;
  proveedoresConFacturas: number;
  proveedoresTotales: number;
};

export type ExportResult = { base64: string; filename: string };
