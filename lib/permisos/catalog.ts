// Permission catalog — single source of truth for both the seed (writes rows
// to the `permisos` table) and the editor UI (renders checkboxes grouped by
// module). Adding a new permission means editing this file + the next
// migration's seed run picks it up.
//
// Codes use dot-namespacing `modulo.accion` (or `modulo.entidad.accion` when a
// module needs finer carve-outs). `admin.all` is the umbrella — holding it
// implies every other permission via hasPermission().

export type PermisoCodigo = string;

export type PermisoDef = {
  codigo: PermisoCodigo;
  modulo: Modulo;
  descripcion: string;
};

export type Modulo =
  | "admin"
  | "maquinaria"
  | "inventario"
  | "compras"
  | "mantenimiento"
  | "ot"
  | "estadisticas"
  | "listados";

export const MODULO_LABELS: Record<Modulo, string> = {
  admin: "Administración",
  maquinaria: "Maquinaria",
  inventario: "Inventario",
  compras: "Compras",
  mantenimiento: "Mantenimiento",
  ot: "Órdenes de Trabajo",
  estadisticas: "Estadísticas",
  listados: "Listados",
};

// Order drives the order of <section> blocks in the editor UI.
export const MODULO_ORDEN: Modulo[] = [
  "maquinaria",
  "inventario",
  "compras",
  "mantenimiento",
  "ot",
  "estadisticas",
  "listados",
  "admin",
];

export const ADMIN_ALL: PermisoCodigo = "admin.all";

export const PERMISOS_CATALOG: PermisoDef[] = [
  // Umbrella
  {
    codigo: ADMIN_ALL,
    modulo: "admin",
    descripcion: "Acceso total (umbrella — implica todos los permisos)",
  },

  // Maquinaria
  { codigo: "maquinaria.view", modulo: "maquinaria", descripcion: "Ver listado y detalle" },
  { codigo: "maquinaria.create", modulo: "maquinaria", descripcion: "Crear nueva máquina" },
  { codigo: "maquinaria.update", modulo: "maquinaria", descripcion: "Editar ficha" },
  { codigo: "maquinaria.delete", modulo: "maquinaria", descripcion: "Dar de baja" },
  {
    codigo: "maquinaria.tipos.manage",
    modulo: "maquinaria",
    descripcion: "Gestionar tipos y estructura (niveles/atributos)",
  },
  {
    codigo: "maquinaria.columnas.configure",
    modulo: "maquinaria",
    descripcion: "Reordenar y ocultar columnas",
  },

  // Inventario
  { codigo: "inventario.view", modulo: "inventario", descripcion: "Ver listado y detalle" },
  { codigo: "inventario.create", modulo: "inventario", descripcion: "Alta de ítem" },
  { codigo: "inventario.update", modulo: "inventario", descripcion: "Editar ítem (incluye stock mínimo)" },
  { codigo: "inventario.delete", modulo: "inventario", descripcion: "Dar de baja" },
  {
    codigo: "inventario.movimiento.create",
    modulo: "inventario",
    descripcion: "Registrar movimientos (entrada/salida)",
  },
  {
    codigo: "inventario.ajuste_stock",
    modulo: "inventario",
    descripcion: "Ajuste directo de stock",
  },
  {
    codigo: "inventario.import_export",
    modulo: "inventario",
    descripcion: "Importar / exportar XLSX",
  },

  // Compras
  { codigo: "compras.view", modulo: "compras", descripcion: "Ver requisiciones, OCs, recepciones y facturas" },
  { codigo: "compras.requisicion.create", modulo: "compras", descripcion: "Crear requisición" },
  {
    codigo: "compras.requisicion.approve",
    modulo: "compras",
    descripcion: "Aprobar / rechazar requisiciones",
  },
  { codigo: "compras.oc.create", modulo: "compras", descripcion: "Generar órdenes de compra" },
  { codigo: "compras.oc.update", modulo: "compras", descripcion: "Editar orden de compra" },
  {
    codigo: "compras.recepcion.create",
    modulo: "compras",
    descripcion: "Registrar recepciones",
  },
  {
    codigo: "compras.recepcion.update",
    modulo: "compras",
    descripcion: "Editar recepciones",
  },
  { codigo: "compras.factura.create", modulo: "compras", descripcion: "Cargar factura" },
  { codigo: "compras.factura.update", modulo: "compras", descripcion: "Editar factura" },

  // Mantenimiento
  { codigo: "mantenimiento.view", modulo: "mantenimiento", descripcion: "Ver listado y detalle" },
  { codigo: "mantenimiento.create", modulo: "mantenimiento", descripcion: "Crear mantenimiento" },
  {
    codigo: "mantenimiento.update",
    modulo: "mantenimiento",
    descripcion: "Editar mantenimiento (incluye transiciones de estado)",
  },
  {
    codigo: "mantenimiento.cancel",
    modulo: "mantenimiento",
    descripcion: "Cancelar mantenimiento",
  },
  { codigo: "mantenimiento.delete", modulo: "mantenimiento", descripcion: "Dar de baja" },
  {
    codigo: "mantenimiento.plantillas.manage",
    modulo: "mantenimiento",
    descripcion: "Gestionar plantillas y aplicar",
  },
  {
    codigo: "mantenimiento.horas.register",
    modulo: "mantenimiento",
    descripcion: "Registrar horas de maquinaria",
  },

  // Órdenes de Trabajo
  { codigo: "ot.view", modulo: "ot", descripcion: "Ver listado y detalle" },
  { codigo: "ot.create", modulo: "ot", descripcion: "Crear orden de trabajo" },
  { codigo: "ot.update", modulo: "ot", descripcion: "Editar orden de trabajo" },
  { codigo: "ot.close", modulo: "ot", descripcion: "Cerrar orden de trabajo" },
  { codigo: "ot.delete", modulo: "ot", descripcion: "Dar de baja" },

  // Estadísticas
  { codigo: "estadisticas.view", modulo: "estadisticas", descripcion: "Ver dashboard, ABC, precios y maquinaria" },
  {
    codigo: "estadisticas.proveedores.view",
    modulo: "estadisticas",
    descripcion: "Ver gasto por proveedor",
  },
  { codigo: "estadisticas.export", modulo: "estadisticas", descripcion: "Exportar XLSX" },

  // Listados (master data)
  { codigo: "listados.view", modulo: "listados", descripcion: "Ver listados (solo lectura)" },
  {
    codigo: "listados.usuarios.manage",
    modulo: "listados",
    descripcion: "Gestionar usuarios e invitaciones",
  },
  {
    codigo: "listados.roles.manage",
    modulo: "listados",
    descripcion: "Gestionar roles y sus permisos",
  },
  {
    codigo: "listados.proveedores.manage",
    modulo: "listados",
    descripcion: "Gestionar proveedores",
  },
  {
    codigo: "listados.master_data.manage",
    modulo: "listados",
    descripcion: "Gestionar localidades, tipos de unidad, unidades de medida y unidades productivas",
  },
];

// Baseline permisos granted to a legacy `Pañolero` rol at seed time, matching
// what the hard-coded isPañolero predicate allowed today. Admin can edit
// after seed — seed never revokes.
export const PANOLERO_BASELINE: PermisoCodigo[] = [
  "maquinaria.view",
  "inventario.view",
  "inventario.movimiento.create",
  "compras.view",
  "compras.requisicion.create",
  "compras.recepcion.create",
  "mantenimiento.view",
  "ot.view",
  "estadisticas.view",
  "listados.view",
];

export function isValidCodigo(codigo: string): boolean {
  return PERMISOS_CATALOG.some((p) => p.codigo === codigo);
}
