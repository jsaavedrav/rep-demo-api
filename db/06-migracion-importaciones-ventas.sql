/*
  Migración para bases ya creadas (2026-11): importaciones y ventas como movimientos separados.
  - rep.programa.base_calculo: qué movimientos forman la línea base ('importacion' = DIN, 'venta' = facturas).
    Neumáticos sigue con DIN; Envases y embalajes pasa a ventas (las importaciones sirven para el control de stock).
  - rep.movimiento.tipo: 'importacion' o 'venta'. Los registros existentes quedan como 'importacion'.
  - Pesos con 7 decimales en kg (la especificación de envases usa gramos con 4 decimales).
  - Envases y embalajes: atributos de la especificación (Tipo de envase, Clasificación, Subcategoría).
  Idempotente. Bases nuevas no la necesitan (01 y 02 ya traen estos cambios).
  Ejecutar como script (separado por GO): en DBeaver, "Execute SQL Script" (Alt+X).
*/
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

IF COL_LENGTH('rep.programa', 'base_calculo') IS NULL
  ALTER TABLE rep.programa ADD base_calculo varchar(20) NOT NULL
    CONSTRAINT df_programa_base_calculo DEFAULT ('importacion')
    CONSTRAINT ck_programa_base_calculo CHECK (base_calculo IN ('importacion', 'venta'));

IF COL_LENGTH('rep.movimiento', 'tipo') IS NULL
  ALTER TABLE rep.movimiento ADD tipo varchar(20) NOT NULL
    CONSTRAINT df_movimiento_tipo DEFAULT ('importacion')
    CONSTRAINT ck_movimiento_tipo CHECK (tipo IN ('importacion', 'venta'));
GO

/* La misma línea puede venir en la planilla de importaciones y en la de ventas: el tipo es parte de la clave. */
IF EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = 'ux_movimiento_origen' AND COL_NAME(ic.object_id, ic.column_id) = 'tipo')
  PRINT 'Índices ya incluyen el tipo';
ELSE
BEGIN
  DROP INDEX IF EXISTS ux_movimiento_origen ON rep.movimiento;
  DROP INDEX IF EXISTS ux_movimiento_natural ON rep.movimiento;
  CREATE UNIQUE INDEX ux_movimiento_origen ON rep.movimiento (programa_id, tipo, id_origen) WHERE id_origen IS NOT NULL;
  CREATE UNIQUE INDEX ux_movimiento_natural ON rep.movimiento (programa_id, tipo, documento, sku, fecha, sucursal_codigo) WHERE id_origen IS NULL;
END;

ALTER TABLE rep.importacion DROP CONSTRAINT ck_importacion_tipo;
ALTER TABLE rep.importacion ADD CONSTRAINT ck_importacion_tipo CHECK (tipo IN ('catalogo', 'movimientos', 'ventas', 'importaciones'));

/* Pesos: decimal(14,6) -> decimal(16,7). El CHECK se recrea porque bloquea el cambio de tipo. */
IF (SELECT scale FROM sys.columns WHERE object_id = OBJECT_ID('rep.sku_componente') AND name = 'peso_kg') < 7
BEGIN
  ALTER TABLE rep.sku_componente DROP CONSTRAINT ck_sku_componente_peso;
  ALTER TABLE rep.sku_componente ALTER COLUMN peso_kg decimal(16,7) NULL;
  ALTER TABLE rep.sku_componente ADD CONSTRAINT ck_sku_componente_peso CHECK (peso_kg IS NULL OR peso_kg > 0);
  ALTER TABLE rep.movimiento_componente DROP CONSTRAINT ck_mov_comp_peso;
  ALTER TABLE rep.movimiento_componente ALTER COLUMN peso_kg decimal(16,7) NULL;
  ALTER TABLE rep.movimiento_componente ADD CONSTRAINT ck_mov_comp_peso CHECK (peso_kg IS NULL OR peso_kg > 0);
END;
GO

/* Los informes solo suman los movimientos que forman la línea base de cada producto. */
CREATE OR ALTER VIEW rep.v_informe_kilos AS
SELECT
  m.programa_id,
  m.id                 AS movimiento_id,
  m.tipo,
  m.id_origen,
  m.documento,
  m.fecha,
  m.anio_comercial,
  m.sucursal_codigo,
  s.nombre             AS sucursal,
  m.proveedor,
  m.sku,
  c.id                 AS componente_id,
  c.nombre             AS componente,
  c.atributos,
  m.unidades,
  mc.peso_kg,
  CAST(m.unidades * mc.peso_kg AS decimal(18,3))          AS kilos,
  CAST(m.unidades * mc.peso_kg / 1000 AS decimal(18,6))   AS toneladas
FROM rep.movimiento m
JOIN rep.programa p ON p.id = m.programa_id AND p.base_calculo = m.tipo
JOIN rep.movimiento_componente mc ON mc.movimiento_id = m.id
JOIN rep.sku_componente c ON c.id = mc.componente_id
LEFT JOIN rep.sucursal s ON s.codigo = m.sucursal_codigo;
GO

/* Envases y embalajes según la especificación (DS 12): línea base por ventas y nuevos atributos.
   Los atributos anteriores (Material libre, Subcategoría, Clase, Peligrosidad) se reemplazan; los
   componentes ya cargados conservan su JSON, por eso los datos de ejemplo se recargan con 07 + 03. */
UPDATE rep.programa SET base_calculo = 'venta', agrupador = 'clase', desglose = 'material' WHERE id = 'env';

DELETE FROM rep.programa_atributo WHERE programa_id = 'env' AND clave NOT IN ('tipo', 'clase', 'material');
MERGE rep.programa_atributo AS t
USING (VALUES
  ('env', 'tipo',     N'Tipo de envase', 1, 'texto', 1, N'["Primario","Secundario","Terciario"]'),
  ('env', 'clase',    N'Clasificación',  2, 'texto', 1, N'["Domiciliario","No domiciliario"]'),
  ('env', 'material', N'Subcategoría',   3, 'texto', 1, N'["Cartón para líquidos","Metal","Papel y cartón","Plástico","Vidrio","Madera"]')
) AS s (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores) ON t.programa_id = s.programa_id AND t.clave = s.clave
WHEN MATCHED THEN UPDATE SET etiqueta = s.etiqueta, orden = s.orden, tipo = s.tipo, obligatorio = s.obligatorio, valores = s.valores
WHEN NOT MATCHED THEN INSERT (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores)
  VALUES (s.programa_id, s.clave, s.etiqueta, s.orden, s.tipo, s.obligatorio, s.valores);

COMMIT TRANSACTION;
