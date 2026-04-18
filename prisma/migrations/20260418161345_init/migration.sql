-- CreateTable
CREATE TABLE "roles" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "rol_id" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "abreviacion" TEXT NOT NULL,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localidades" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "localidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_unidad" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipos_unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_productivas" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "localidad_id" INTEGER,
    "tipo_unidad_id" INTEGER,

    CONSTRAINT "unidades_productivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "localidad_id" INTEGER,
    "direccion" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "cuit" TEXT,
    "condicion_iva" TEXT,
    "nombre_contacto" TEXT,
    "direccion_fiscal" TEXT,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id" INTEGER NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "categoria" TEXT,
    "localidad" TEXT,
    "unidad_productiva" TEXT,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock_minimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidad_medida" TEXT,
    "valor_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proveedor" TEXT,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_movimientos" (
    "id" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidad_medida" TEXT,
    "valor_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuario" TEXT NOT NULL,
    "motivo" TEXT,
    "modulo_origen" TEXT,
    "id_origen" INTEGER,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_diarios" (
    "id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3),
    "codigo_item" TEXT,
    "descripcion" TEXT,
    "cantidad" DOUBLE PRECISION,
    "unidad_medida" TEXT,
    "usuario" TEXT,
    "localidad" TEXT,
    "sector" TEXT,
    "proveedor" TEXT,
    "factura" TEXT,
    "monto" DOUBLE PRECISION,
    "observaciones" TEXT,
    "justificacion" TEXT,
    "localidad_id" INTEGER,
    "unidad_productiva_id" INTEGER,

    CONSTRAINT "movimientos_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquinaria_tipos" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "unidad_medicion" TEXT DEFAULT 'Horas',
    "abrev_unidad" TEXT DEFAULT 'hs',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquinaria_tipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_niveles" (
    "id" INTEGER NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "parent_level_id" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "permite_inventario" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nivel_atributos" (
    "id" INTEGER NOT NULL,
    "nivel_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "list_options" TEXT,
    "source_ref" TEXT,
    "default_value" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nivel_atributos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquinaria" (
    "id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "nro_serie" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "horas_acumuladas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquina_nodos" (
    "id" INTEGER NOT NULL,
    "maquinaria_id" INTEGER NOT NULL,
    "nivel_def_id" INTEGER NOT NULL,
    "parent_node_id" INTEGER,
    "inventario_item_id" INTEGER,
    "fecha_instalacion" TIMESTAMP(3),
    "fecha_retiro" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquina_nodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquina_atributos_valores" (
    "id" INTEGER NOT NULL,
    "nodo_id" INTEGER NOT NULL,
    "atributo_def_id" INTEGER NOT NULL,
    "value_text" TEXT,
    "value_num" DOUBLE PRECISION,
    "value_date" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maquina_atributos_valores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_horas_maquinaria" (
    "id" INTEGER NOT NULL,
    "id_maquinaria" INTEGER NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horas_anterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horas_nuevo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horas_diferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipo_actualizacion" TEXT,
    "observaciones" TEXT,
    "usuario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_horas_maquinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabla_config" (
    "id" INTEGER NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "target_depth" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL,
    "column_kind" TEXT NOT NULL,
    "builtin_key" TEXT,
    "attribute_id" INTEGER,
    "level_def_id" INTEGER,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabla_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisiciones" (
    "id" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitante" TEXT NOT NULL,
    "unidad_productiva" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'Normal',
    "estado" TEXT NOT NULL DEFAULT 'Borrador',
    "fecha_tentativa" TIMESTAMP(3),
    "fecha_limite" TIMESTAMP(3),
    "notas" TEXT,
    "creado_por" TEXT,
    "fecha_aprobacion" TIMESTAMP(3),
    "aprobado_por" TEXT,
    "fecha_cancelacion" TIMESTAMP(3),
    "cancelado_por" TEXT,
    "numero_orden_interna" TEXT,

    CONSTRAINT "requisiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisiciones_detalle" (
    "id" INTEGER NOT NULL,
    "requisicion_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "prioridad_item" TEXT NOT NULL DEFAULT 'Normal',
    "notas_item" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',

    CONSTRAINT "requisiciones_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" INTEGER NOT NULL,
    "numero_oc" TEXT,
    "proveedor_id" INTEGER NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprador" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Emitida',
    "total_estimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "creado_por" TEXT,
    "fecha_cancelacion" TIMESTAMP(3),
    "cancelado_por" TEXT,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra_detalle" (
    "id" INTEGER NOT NULL,
    "oc_id" INTEGER NOT NULL,
    "requisicion_detalle_id" INTEGER NOT NULL,
    "cantidad_solicitada" DOUBLE PRECISION NOT NULL,
    "cantidad_recibida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precio_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ordenes_compra_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones" (
    "id" INTEGER NOT NULL,
    "oc_id" INTEGER NOT NULL,
    "numero_remito" TEXT NOT NULL,
    "fecha_recepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibido_por" TEXT NOT NULL,
    "observaciones" TEXT,
    "creado_por" TEXT,

    CONSTRAINT "recepciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones_detalle" (
    "id" INTEGER NOT NULL,
    "recepcion_id" INTEGER NOT NULL,
    "oc_detalle_id" INTEGER NOT NULL,
    "cantidad_recibida" DOUBLE PRECISION NOT NULL,
    "facturado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "recepciones_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" INTEGER NOT NULL,
    "numero_factura" TEXT NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "fecha_factura" TIMESTAMP(3) NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "usuario" TEXT,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento_comercial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento_financiero" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recargo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neto_gravado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva_porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "iva_monto" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_detalle" (
    "id" INTEGER NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "recepcion_detalle_id" INTEGER NOT NULL,
    "precio_unitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "descuento_comercial_porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "factura_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_historico" (
    "id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "precio_ars" DOUBLE PRECISION NOT NULL,
    "fuente" TEXT,
    "numero_documento" TEXT,
    "usuario" TEXT,

    CONSTRAINT "precios_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolar_cotizaciones" (
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tc_promedio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "dolar_cotizaciones_pkey" PRIMARY KEY ("anio","mes")
);

-- CreateTable
CREATE TABLE "mantenimientos" (
    "id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "maquinaria_id" INTEGER NOT NULL,
    "prioridad" TEXT NOT NULL,
    "descripcion" TEXT,
    "responsable_id" INTEGER NOT NULL,
    "unidad_productiva_id" INTEGER,
    "estado" TEXT NOT NULL,
    "taller_asignado_id" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_finalizacion" TIMESTAMP(3),
    "programar_revision" BOOLEAN NOT NULL DEFAULT false,
    "fecha_proxima_revision" TIMESTAMP(3),
    "descripcion_revision" TEXT,
    "creado_por" TEXT,
    "es_recurrente" BOOLEAN NOT NULL DEFAULT true,
    "plantilla_id" INTEGER,
    "frecuencia_valor" DOUBLE PRECISION,
    "frecuencia_unidad" TEXT,
    "fecha_programada" TIMESTAMP(3),
    "uso_estimado_diario" DOUBLE PRECISION,
    "unidad_estimacion" TEXT,
    "metodo_calculo" TEXT,

    CONSTRAINT "mantenimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_mantenimiento" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_maquinaria_id" INTEGER NOT NULL,
    "frecuencia_valor" DOUBLE PRECISION NOT NULL,
    "frecuencia_unidad" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "descripcion" TEXT,
    "creado_por" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_insumos" (
    "id" INTEGER NOT NULL,
    "plantilla_id" INTEGER NOT NULL,
    "item_inventario_id" INTEGER NOT NULL,
    "cantidad_sugerida" DOUBLE PRECISION NOT NULL,
    "unidad_medida" TEXT NOT NULL,

    CONSTRAINT "plantilla_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_tareas" (
    "id" INTEGER NOT NULL,
    "plantilla_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plantilla_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimiento_insumos" (
    "id" INTEGER NOT NULL,
    "mantenimiento_id" INTEGER NOT NULL,
    "item_inventario_id" INTEGER NOT NULL,
    "cantidad_sugerida" DOUBLE PRECISION NOT NULL,
    "cantidad_utilizada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidad_medida" TEXT NOT NULL,
    "costo_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proveedor_id" INTEGER,

    CONSTRAINT "mantenimiento_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimiento_tareas" (
    "id" INTEGER NOT NULL,
    "mantenimiento_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "realizada" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_de_plantilla" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mantenimiento_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimiento_historial" (
    "id" INTEGER NOT NULL,
    "mantenimiento_id" INTEGER NOT NULL,
    "tipo_cambio" TEXT NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "detalle" TEXT,
    "fecha_cambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario" TEXT NOT NULL,

    CONSTRAINT "mantenimiento_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" INTEGER NOT NULL,
    "numero_ot" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_finalizacion" TIMESTAMP(3),
    "localidad_id" INTEGER,
    "unidad_productiva_id" INTEGER,
    "solicitante_id" INTEGER,
    "responsable_id" INTEGER,
    "prioridad" TEXT NOT NULL DEFAULT 'Media',
    "estado" TEXT NOT NULL DEFAULT 'En Curso',
    "titulo" TEXT NOT NULL,
    "descripcion_trabajo" TEXT,
    "observaciones" TEXT,
    "creado_por" TEXT,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_insumos" (
    "id" INTEGER NOT NULL,
    "ot_id" INTEGER NOT NULL,
    "item_inventario_id" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidad_medida" TEXT,
    "costo_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado_solicitud" TEXT,

    CONSTRAINT "ot_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_nombre_key" ON "unidades_medida"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "localidades_nombre_key" ON "localidades"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_unidad_nombre_key" ON "tipos_unidad"("nombre");

-- CreateIndex
CREATE INDEX "proveedores_localidad_id_idx" ON "proveedores"("localidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_codigo_key" ON "inventario"("codigo");

-- CreateIndex
CREATE INDEX "inventario_movimientos_id_item_idx" ON "inventario_movimientos"("id_item");

-- CreateIndex
CREATE INDEX "inventario_movimientos_fecha_idx" ON "inventario_movimientos"("fecha");

-- CreateIndex
CREATE INDEX "inventario_movimientos_modulo_origen_idx" ON "inventario_movimientos"("modulo_origen");

-- CreateIndex
CREATE UNIQUE INDEX "maquinaria_tipos_nombre_key" ON "maquinaria_tipos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_niveles_tipo_id_parent_level_id_nombre_key" ON "tipo_niveles"("tipo_id", "parent_level_id", "nombre");

-- CreateIndex
CREATE INDEX "nivel_atributos_data_type_source_ref_activo_idx" ON "nivel_atributos"("data_type", "source_ref", "activo");

-- CreateIndex
CREATE INDEX "nivel_atributos_es_principal_activo_idx" ON "nivel_atributos"("es_principal", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "nivel_atributos_nivel_id_nombre_key" ON "nivel_atributos"("nivel_id", "nombre");

-- CreateIndex
CREATE INDEX "maquinaria_type_id_idx" ON "maquinaria"("type_id");

-- CreateIndex
CREATE INDEX "maquina_nodos_maquinaria_id_activo_inventario_item_id_idx" ON "maquina_nodos"("maquinaria_id", "activo", "inventario_item_id");

-- CreateIndex
CREATE INDEX "maquina_nodos_parent_node_id_idx" ON "maquina_nodos"("parent_node_id");

-- CreateIndex
CREATE INDEX "maquina_atributos_valores_nodo_id_idx" ON "maquina_atributos_valores"("nodo_id");

-- CreateIndex
CREATE INDEX "maquina_atributos_valores_nodo_id_atributo_def_id_value_tex_idx" ON "maquina_atributos_valores"("nodo_id", "atributo_def_id", "value_text");

-- CreateIndex
CREATE UNIQUE INDEX "maquina_atributos_valores_nodo_id_atributo_def_id_key" ON "maquina_atributos_valores"("nodo_id", "atributo_def_id");

-- CreateIndex
CREATE INDEX "requisiciones_estado_idx" ON "requisiciones"("estado");

-- CreateIndex
CREATE INDEX "requisiciones_localidad_idx" ON "requisiciones"("localidad");

-- CreateIndex
CREATE INDEX "requisiciones_numero_orden_interna_idx" ON "requisiciones"("numero_orden_interna");

-- CreateIndex
CREATE INDEX "requisiciones_detalle_requisicion_id_idx" ON "requisiciones_detalle"("requisicion_id");

-- CreateIndex
CREATE INDEX "requisiciones_detalle_item_id_idx" ON "requisiciones_detalle"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_oc_key" ON "ordenes_compra"("numero_oc");

-- CreateIndex
CREATE INDEX "ordenes_compra_proveedor_id_idx" ON "ordenes_compra"("proveedor_id");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "ordenes_compra_detalle_oc_id_idx" ON "ordenes_compra_detalle"("oc_id");

-- CreateIndex
CREATE INDEX "ordenes_compra_detalle_requisicion_detalle_id_idx" ON "ordenes_compra_detalle"("requisicion_detalle_id");

-- CreateIndex
CREATE INDEX "recepciones_oc_id_idx" ON "recepciones"("oc_id");

-- CreateIndex
CREATE INDEX "recepciones_detalle_recepcion_id_idx" ON "recepciones_detalle"("recepcion_id");

-- CreateIndex
CREATE INDEX "recepciones_detalle_oc_detalle_id_idx" ON "recepciones_detalle"("oc_detalle_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_factura_key" ON "facturas"("numero_factura");

-- CreateIndex
CREATE INDEX "facturas_proveedor_id_idx" ON "facturas"("proveedor_id");

-- CreateIndex
CREATE INDEX "factura_detalle_factura_id_idx" ON "factura_detalle"("factura_id");

-- CreateIndex
CREATE INDEX "factura_detalle_recepcion_detalle_id_idx" ON "factura_detalle"("recepcion_detalle_id");

-- CreateIndex
CREATE INDEX "precios_historico_item_id_proveedor_id_idx" ON "precios_historico"("item_id", "proveedor_id");

-- CreateIndex
CREATE INDEX "precios_historico_fecha_idx" ON "precios_historico"("fecha");

-- CreateIndex
CREATE INDEX "mantenimientos_tipo_idx" ON "mantenimientos"("tipo");

-- CreateIndex
CREATE INDEX "mantenimientos_estado_idx" ON "mantenimientos"("estado");

-- CreateIndex
CREATE INDEX "mantenimientos_maquinaria_id_idx" ON "mantenimientos"("maquinaria_id");

-- CreateIndex
CREATE INDEX "mantenimientos_fecha_creacion_idx" ON "mantenimientos"("fecha_creacion");

-- CreateIndex
CREATE INDEX "mantenimientos_responsable_id_idx" ON "mantenimientos"("responsable_id");

-- CreateIndex
CREATE INDEX "mantenimientos_fecha_programada_idx" ON "mantenimientos"("fecha_programada");

-- CreateIndex
CREATE INDEX "mantenimientos_estado_tipo_idx" ON "mantenimientos"("estado", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_mantenimiento_nombre_key" ON "plantillas_mantenimiento"("nombre");

-- CreateIndex
CREATE INDEX "plantillas_mantenimiento_tipo_maquinaria_id_idx" ON "plantillas_mantenimiento"("tipo_maquinaria_id");

-- CreateIndex
CREATE INDEX "plantilla_insumos_plantilla_id_idx" ON "plantilla_insumos"("plantilla_id");

-- CreateIndex
CREATE INDEX "plantilla_insumos_item_inventario_id_idx" ON "plantilla_insumos"("item_inventario_id");

-- CreateIndex
CREATE INDEX "plantilla_tareas_plantilla_id_idx" ON "plantilla_tareas"("plantilla_id");

-- CreateIndex
CREATE INDEX "mantenimiento_insumos_mantenimiento_id_idx" ON "mantenimiento_insumos"("mantenimiento_id");

-- CreateIndex
CREATE INDEX "mantenimiento_insumos_item_inventario_id_idx" ON "mantenimiento_insumos"("item_inventario_id");

-- CreateIndex
CREATE INDEX "mantenimiento_insumos_proveedor_id_idx" ON "mantenimiento_insumos"("proveedor_id");

-- CreateIndex
CREATE INDEX "mantenimiento_tareas_mantenimiento_id_idx" ON "mantenimiento_tareas"("mantenimiento_id");

-- CreateIndex
CREATE INDEX "mantenimiento_historial_mantenimiento_id_idx" ON "mantenimiento_historial"("mantenimiento_id");

-- CreateIndex
CREATE INDEX "mantenimiento_historial_fecha_cambio_idx" ON "mantenimiento_historial"("fecha_cambio");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_numero_ot_key" ON "ordenes_trabajo"("numero_ot");

-- CreateIndex
CREATE INDEX "ot_insumos_ot_id_idx" ON "ot_insumos"("ot_id");

-- CreateIndex
CREATE INDEX "ot_insumos_item_inventario_id_idx" ON "ot_insumos"("item_inventario_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_productivas" ADD CONSTRAINT "unidades_productivas_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_productivas" ADD CONSTRAINT "unidades_productivas_tipo_unidad_id_fkey" FOREIGN KEY ("tipo_unidad_id") REFERENCES "tipos_unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimientos" ADD CONSTRAINT "inventario_movimientos_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_niveles" ADD CONSTRAINT "tipo_niveles_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "maquinaria_tipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_niveles" ADD CONSTRAINT "tipo_niveles_parent_level_id_fkey" FOREIGN KEY ("parent_level_id") REFERENCES "tipo_niveles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nivel_atributos" ADD CONSTRAINT "nivel_atributos_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "tipo_niveles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquinaria" ADD CONSTRAINT "maquinaria_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "maquinaria_tipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_nodos" ADD CONSTRAINT "maquina_nodos_maquinaria_id_fkey" FOREIGN KEY ("maquinaria_id") REFERENCES "maquinaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_nodos" ADD CONSTRAINT "maquina_nodos_nivel_def_id_fkey" FOREIGN KEY ("nivel_def_id") REFERENCES "tipo_niveles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_nodos" ADD CONSTRAINT "maquina_nodos_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "maquina_nodos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_nodos" ADD CONSTRAINT "maquina_nodos_inventario_item_id_fkey" FOREIGN KEY ("inventario_item_id") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_atributos_valores" ADD CONSTRAINT "maquina_atributos_valores_nodo_id_fkey" FOREIGN KEY ("nodo_id") REFERENCES "maquina_nodos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquina_atributos_valores" ADD CONSTRAINT "maquina_atributos_valores_atributo_def_id_fkey" FOREIGN KEY ("atributo_def_id") REFERENCES "nivel_atributos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_horas_maquinaria" ADD CONSTRAINT "registro_horas_maquinaria_id_maquinaria_fkey" FOREIGN KEY ("id_maquinaria") REFERENCES "maquinaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabla_config" ADD CONSTRAINT "tabla_config_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "maquinaria_tipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabla_config" ADD CONSTRAINT "tabla_config_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "nivel_atributos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabla_config" ADD CONSTRAINT "tabla_config_level_def_id_fkey" FOREIGN KEY ("level_def_id") REFERENCES "tipo_niveles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_detalle" ADD CONSTRAINT "requisiciones_detalle_requisicion_id_fkey" FOREIGN KEY ("requisicion_id") REFERENCES "requisiciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_detalle" ADD CONSTRAINT "requisiciones_detalle_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_oc_id_fkey" FOREIGN KEY ("oc_id") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_requisicion_detalle_id_fkey" FOREIGN KEY ("requisicion_detalle_id") REFERENCES "requisiciones_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_oc_id_fkey" FOREIGN KEY ("oc_id") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_detalle" ADD CONSTRAINT "recepciones_detalle_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_detalle" ADD CONSTRAINT "recepciones_detalle_oc_detalle_id_fkey" FOREIGN KEY ("oc_detalle_id") REFERENCES "ordenes_compra_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle" ADD CONSTRAINT "factura_detalle_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle" ADD CONSTRAINT "factura_detalle_recepcion_detalle_id_fkey" FOREIGN KEY ("recepcion_detalle_id") REFERENCES "recepciones_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_historico" ADD CONSTRAINT "precios_historico_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_historico" ADD CONSTRAINT "precios_historico_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_maquinaria_id_fkey" FOREIGN KEY ("maquinaria_id") REFERENCES "maquinaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_unidad_productiva_id_fkey" FOREIGN KEY ("unidad_productiva_id") REFERENCES "unidades_productivas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_taller_asignado_id_fkey" FOREIGN KEY ("taller_asignado_id") REFERENCES "unidades_productivas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_mantenimiento" ADD CONSTRAINT "plantillas_mantenimiento_tipo_maquinaria_id_fkey" FOREIGN KEY ("tipo_maquinaria_id") REFERENCES "maquinaria_tipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_insumos" ADD CONSTRAINT "plantilla_insumos_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_insumos" ADD CONSTRAINT "plantilla_insumos_item_inventario_id_fkey" FOREIGN KEY ("item_inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_tareas" ADD CONSTRAINT "plantilla_tareas_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_mantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_insumos" ADD CONSTRAINT "mantenimiento_insumos_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_insumos" ADD CONSTRAINT "mantenimiento_insumos_item_inventario_id_fkey" FOREIGN KEY ("item_inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_insumos" ADD CONSTRAINT "mantenimiento_insumos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_tareas" ADD CONSTRAINT "mantenimiento_tareas_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_historial" ADD CONSTRAINT "mantenimiento_historial_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_unidad_productiva_id_fkey" FOREIGN KEY ("unidad_productiva_id") REFERENCES "unidades_productivas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_insumos" ADD CONSTRAINT "ot_insumos_ot_id_fkey" FOREIGN KEY ("ot_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_insumos" ADD CONSTRAINT "ot_insumos_item_inventario_id_fkey" FOREIGN KEY ("item_inventario_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
