-- AlterTable
CREATE SEQUENCE factura_detalle_id_seq;
ALTER TABLE "factura_detalle" ALTER COLUMN "id" SET DEFAULT nextval('factura_detalle_id_seq');
ALTER SEQUENCE factura_detalle_id_seq OWNED BY "factura_detalle"."id";

-- AlterTable
CREATE SEQUENCE facturas_id_seq;
ALTER TABLE "facturas" ALTER COLUMN "id" SET DEFAULT nextval('facturas_id_seq');
ALTER SEQUENCE facturas_id_seq OWNED BY "facturas"."id";

-- AlterTable
CREATE SEQUENCE inventario_id_seq;
ALTER TABLE "inventario" ALTER COLUMN "id" SET DEFAULT nextval('inventario_id_seq');
ALTER SEQUENCE inventario_id_seq OWNED BY "inventario"."id";

-- AlterTable
CREATE SEQUENCE inventario_movimientos_id_seq;
ALTER TABLE "inventario_movimientos" ALTER COLUMN "id" SET DEFAULT nextval('inventario_movimientos_id_seq');
ALTER SEQUENCE inventario_movimientos_id_seq OWNED BY "inventario_movimientos"."id";

-- AlterTable
CREATE SEQUENCE localidades_id_seq;
ALTER TABLE "localidades" ALTER COLUMN "id" SET DEFAULT nextval('localidades_id_seq');
ALTER SEQUENCE localidades_id_seq OWNED BY "localidades"."id";

-- AlterTable
CREATE SEQUENCE mantenimiento_historial_id_seq;
ALTER TABLE "mantenimiento_historial" ALTER COLUMN "id" SET DEFAULT nextval('mantenimiento_historial_id_seq');
ALTER SEQUENCE mantenimiento_historial_id_seq OWNED BY "mantenimiento_historial"."id";

-- AlterTable
CREATE SEQUENCE mantenimiento_insumos_id_seq;
ALTER TABLE "mantenimiento_insumos" ALTER COLUMN "id" SET DEFAULT nextval('mantenimiento_insumos_id_seq');
ALTER SEQUENCE mantenimiento_insumos_id_seq OWNED BY "mantenimiento_insumos"."id";

-- AlterTable
CREATE SEQUENCE mantenimiento_tareas_id_seq;
ALTER TABLE "mantenimiento_tareas" ALTER COLUMN "id" SET DEFAULT nextval('mantenimiento_tareas_id_seq');
ALTER SEQUENCE mantenimiento_tareas_id_seq OWNED BY "mantenimiento_tareas"."id";

-- AlterTable
CREATE SEQUENCE mantenimientos_id_seq;
ALTER TABLE "mantenimientos" ALTER COLUMN "id" SET DEFAULT nextval('mantenimientos_id_seq');
ALTER SEQUENCE mantenimientos_id_seq OWNED BY "mantenimientos"."id";

-- AlterTable
CREATE SEQUENCE maquina_atributos_valores_id_seq;
ALTER TABLE "maquina_atributos_valores" ALTER COLUMN "id" SET DEFAULT nextval('maquina_atributos_valores_id_seq');
ALTER SEQUENCE maquina_atributos_valores_id_seq OWNED BY "maquina_atributos_valores"."id";

-- AlterTable
CREATE SEQUENCE maquina_nodos_id_seq;
ALTER TABLE "maquina_nodos" ALTER COLUMN "id" SET DEFAULT nextval('maquina_nodos_id_seq');
ALTER SEQUENCE maquina_nodos_id_seq OWNED BY "maquina_nodos"."id";

-- AlterTable
CREATE SEQUENCE maquinaria_id_seq;
ALTER TABLE "maquinaria" ALTER COLUMN "id" SET DEFAULT nextval('maquinaria_id_seq');
ALTER SEQUENCE maquinaria_id_seq OWNED BY "maquinaria"."id";

-- AlterTable
CREATE SEQUENCE maquinaria_tipos_id_seq;
ALTER TABLE "maquinaria_tipos" ALTER COLUMN "id" SET DEFAULT nextval('maquinaria_tipos_id_seq');
ALTER SEQUENCE maquinaria_tipos_id_seq OWNED BY "maquinaria_tipos"."id";

-- AlterTable
CREATE SEQUENCE movimientos_diarios_id_seq;
ALTER TABLE "movimientos_diarios" ALTER COLUMN "id" SET DEFAULT nextval('movimientos_diarios_id_seq');
ALTER SEQUENCE movimientos_diarios_id_seq OWNED BY "movimientos_diarios"."id";

-- AlterTable
CREATE SEQUENCE nivel_atributos_id_seq;
ALTER TABLE "nivel_atributos" ALTER COLUMN "id" SET DEFAULT nextval('nivel_atributos_id_seq');
ALTER SEQUENCE nivel_atributos_id_seq OWNED BY "nivel_atributos"."id";

-- AlterTable
CREATE SEQUENCE ordenes_compra_id_seq;
ALTER TABLE "ordenes_compra" ALTER COLUMN "id" SET DEFAULT nextval('ordenes_compra_id_seq');
ALTER SEQUENCE ordenes_compra_id_seq OWNED BY "ordenes_compra"."id";

-- AlterTable
CREATE SEQUENCE ordenes_compra_detalle_id_seq;
ALTER TABLE "ordenes_compra_detalle" ALTER COLUMN "id" SET DEFAULT nextval('ordenes_compra_detalle_id_seq');
ALTER SEQUENCE ordenes_compra_detalle_id_seq OWNED BY "ordenes_compra_detalle"."id";

-- AlterTable
CREATE SEQUENCE ordenes_trabajo_id_seq;
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "id" SET DEFAULT nextval('ordenes_trabajo_id_seq');
ALTER SEQUENCE ordenes_trabajo_id_seq OWNED BY "ordenes_trabajo"."id";

-- AlterTable
CREATE SEQUENCE ot_insumos_id_seq;
ALTER TABLE "ot_insumos" ALTER COLUMN "id" SET DEFAULT nextval('ot_insumos_id_seq');
ALTER SEQUENCE ot_insumos_id_seq OWNED BY "ot_insumos"."id";

-- AlterTable
CREATE SEQUENCE plantilla_insumos_id_seq;
ALTER TABLE "plantilla_insumos" ALTER COLUMN "id" SET DEFAULT nextval('plantilla_insumos_id_seq');
ALTER SEQUENCE plantilla_insumos_id_seq OWNED BY "plantilla_insumos"."id";

-- AlterTable
CREATE SEQUENCE plantilla_tareas_id_seq;
ALTER TABLE "plantilla_tareas" ALTER COLUMN "id" SET DEFAULT nextval('plantilla_tareas_id_seq');
ALTER SEQUENCE plantilla_tareas_id_seq OWNED BY "plantilla_tareas"."id";

-- AlterTable
CREATE SEQUENCE plantillas_mantenimiento_id_seq;
ALTER TABLE "plantillas_mantenimiento" ALTER COLUMN "id" SET DEFAULT nextval('plantillas_mantenimiento_id_seq');
ALTER SEQUENCE plantillas_mantenimiento_id_seq OWNED BY "plantillas_mantenimiento"."id";

-- AlterTable
CREATE SEQUENCE precios_historico_id_seq;
ALTER TABLE "precios_historico" ALTER COLUMN "id" SET DEFAULT nextval('precios_historico_id_seq');
ALTER SEQUENCE precios_historico_id_seq OWNED BY "precios_historico"."id";

-- AlterTable
CREATE SEQUENCE proveedores_id_seq;
ALTER TABLE "proveedores" ALTER COLUMN "id" SET DEFAULT nextval('proveedores_id_seq');
ALTER SEQUENCE proveedores_id_seq OWNED BY "proveedores"."id";

-- AlterTable
CREATE SEQUENCE recepciones_id_seq;
ALTER TABLE "recepciones" ALTER COLUMN "id" SET DEFAULT nextval('recepciones_id_seq');
ALTER SEQUENCE recepciones_id_seq OWNED BY "recepciones"."id";

-- AlterTable
CREATE SEQUENCE recepciones_detalle_id_seq;
ALTER TABLE "recepciones_detalle" ALTER COLUMN "id" SET DEFAULT nextval('recepciones_detalle_id_seq');
ALTER SEQUENCE recepciones_detalle_id_seq OWNED BY "recepciones_detalle"."id";

-- AlterTable
CREATE SEQUENCE registro_horas_maquinaria_id_seq;
ALTER TABLE "registro_horas_maquinaria" ALTER COLUMN "id" SET DEFAULT nextval('registro_horas_maquinaria_id_seq');
ALTER SEQUENCE registro_horas_maquinaria_id_seq OWNED BY "registro_horas_maquinaria"."id";

-- AlterTable
CREATE SEQUENCE requisiciones_id_seq;
ALTER TABLE "requisiciones" ALTER COLUMN "id" SET DEFAULT nextval('requisiciones_id_seq');
ALTER SEQUENCE requisiciones_id_seq OWNED BY "requisiciones"."id";

-- AlterTable
CREATE SEQUENCE requisiciones_detalle_id_seq;
ALTER TABLE "requisiciones_detalle" ALTER COLUMN "id" SET DEFAULT nextval('requisiciones_detalle_id_seq');
ALTER SEQUENCE requisiciones_detalle_id_seq OWNED BY "requisiciones_detalle"."id";

-- AlterTable
CREATE SEQUENCE roles_id_seq;
ALTER TABLE "roles" ALTER COLUMN "id" SET DEFAULT nextval('roles_id_seq');
ALTER SEQUENCE roles_id_seq OWNED BY "roles"."id";

-- AlterTable
CREATE SEQUENCE tabla_config_id_seq;
ALTER TABLE "tabla_config" ALTER COLUMN "id" SET DEFAULT nextval('tabla_config_id_seq');
ALTER SEQUENCE tabla_config_id_seq OWNED BY "tabla_config"."id";

-- AlterTable
CREATE SEQUENCE tipo_niveles_id_seq;
ALTER TABLE "tipo_niveles" ALTER COLUMN "id" SET DEFAULT nextval('tipo_niveles_id_seq');
ALTER SEQUENCE tipo_niveles_id_seq OWNED BY "tipo_niveles"."id";

-- AlterTable
CREATE SEQUENCE tipos_unidad_id_seq;
ALTER TABLE "tipos_unidad" ALTER COLUMN "id" SET DEFAULT nextval('tipos_unidad_id_seq');
ALTER SEQUENCE tipos_unidad_id_seq OWNED BY "tipos_unidad"."id";

-- AlterTable
CREATE SEQUENCE unidades_medida_id_seq;
ALTER TABLE "unidades_medida" ALTER COLUMN "id" SET DEFAULT nextval('unidades_medida_id_seq');
ALTER SEQUENCE unidades_medida_id_seq OWNED BY "unidades_medida"."id";

-- AlterTable
CREATE SEQUENCE unidades_productivas_id_seq;
ALTER TABLE "unidades_productivas" ALTER COLUMN "id" SET DEFAULT nextval('unidades_productivas_id_seq');
ALTER SEQUENCE unidades_productivas_id_seq OWNED BY "unidades_productivas"."id";

-- AlterTable
CREATE SEQUENCE usuarios_id_seq;
ALTER TABLE "usuarios" ALTER COLUMN "id" SET DEFAULT nextval('usuarios_id_seq');
ALTER SEQUENCE usuarios_id_seq OWNED BY "usuarios"."id";
