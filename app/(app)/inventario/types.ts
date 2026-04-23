export type InventarioActionResult =
  | { ok: true; id?: number }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      count?: number;
    };

export type RecentMovimiento = {
  id: number;
  fecha: Date;
  tipo: string;
  cantidad: number;
  valorUnitario: number;
  unidadMedida: string | null;
  moduloOrigen: string | null;
  idOrigen: number | null;
  motivo: string | null;
  usuario: string;
};

export type PorLlegarRow = {
  ocId: number;
  ocNumero: string | null;
  ocEstado: string;
  fechaEmision: Date;
  proveedor: string;
  pendiente: number;
  unidadMedida: string | null;
  precioUnitario: number;
};

export type HistorialCompraRow = {
  id: number;
  fecha: Date;
  proveedor: string;
  precioArs: number;
  fuente: string | null;
  numeroDocumento: string | null;
};

export type ExportResult = { base64: string; filename: string };

export type MovimientoExportFilter = {
  itemId?: number;
  tipo?: string;
  modulo?: string;
  desde?: string;
  hasta?: string;
};

export type ImportRow = {
  codigo?: string | null;
  descripcion?: string | null;
  categoria?: string | null;
  localidad?: string | null;
  unidadProductiva?: string | null;
  unidadMedida?: string | null;
  stockMinimo?: number | string | null;
  valorUnitario?: number | string | null;
};

export type ImportPreviewRow = {
  rowIndex: number;
  codigo: string | null;
  descripcion: string | null;
  status: "new" | "updated" | "unchanged" | "invalid";
  invalidReason?: string;
  changedFields?: string[];
};

export type ImportPreview = {
  counts: { new: number; updated: number; unchanged: number; invalid: number };
  rows: ImportPreviewRow[];
  total: number;
};
