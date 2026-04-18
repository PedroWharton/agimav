export const ITEM_HEADERS = [
  "Código",
  "Descripción",
  "Categoría",
  "Localidad",
  "Unidad productiva",
  "Unidad de medida",
  "Stock",
  "Stock mínimo",
  "Valor unitario",
  "Valor total",
] as const;

export const MOV_HEADERS = [
  "Fecha",
  "Código",
  "Descripción",
  "Tipo",
  "Cantidad",
  "Unidad",
  "Valor unitario",
  "Módulo",
  "ID origen",
  "Motivo",
  "Observaciones",
  "Usuario",
] as const;

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type CanonicalKey =
  | "codigo"
  | "descripcion"
  | "categoria"
  | "localidad"
  | "unidadProductiva"
  | "unidadMedida"
  | "stockMinimo"
  | "valorUnitario";

const HEADER_ALIASES: Record<string, CanonicalKey> = {
  codigo: "codigo",
  cod: "codigo",
  code: "codigo",
  descripcion: "descripcion",
  descripción: "descripcion",
  description: "descripcion",
  detalle: "descripcion",
  categoria: "categoria",
  rubro: "categoria",
  localidad: "localidad",
  ubicacion: "localidad",
  unidad_productiva: "unidadProductiva",
  up: "unidadProductiva",
  unidad_de_medida: "unidadMedida",
  unidad_medida: "unidadMedida",
  unidad: "unidadMedida",
  um: "unidadMedida",
  stock_minimo: "stockMinimo",
  minimo: "stockMinimo",
  min: "stockMinimo",
  valor_unitario: "valorUnitario",
  precio: "valorUnitario",
  precio_unitario: "valorUnitario",
};

export function matchHeader(raw: string): CanonicalKey | null {
  const norm = normalizeHeader(raw);
  return HEADER_ALIASES[norm] ?? null;
}
