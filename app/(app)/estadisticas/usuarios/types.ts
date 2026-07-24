export const USR_RANGES = ["30d", "90d", "ytd", "todo"] as const;
export type UsrRange = (typeof USR_RANGES)[number];

export type UsrRow = {
  nombre: string;
  facturas: number;
  gasto: number;
  porcentaje: number;
  requisiciones: number;
  ultima: Date | null;
};

export type UsrResult = {
  rows: UsrRow[];
  totalGasto: number;
  usuariosConGasto: number;
  requisicionesTotal: number;
};

export type ExportResult = { base64: string; filename: string };

export type UsrDetalleFactura = {
  id: number;
  numeroFactura: string;
  proveedor: string;
  fechaFactura: Date;
  total: number;
};

export type UsrDetalleRequisicion = {
  id: number;
  fechaCreacion: Date;
  estado: string;
};

export type UsrDetalle = {
  nombre: string;
  facturas: UsrDetalleFactura[];
  requisiciones: UsrDetalleRequisicion[];
  totalFacturado: number;
};
