/* =============================================================================
   Declaración REP - Datos maestros (DML)  ·  OBLIGATORIO
   Ejecutar después de 01-ddl.sql. Idempotente: se puede correr varias veces.
   - Sección 1: perfiles, permisos, los 6 productos prioritarios, atributos, metas del DS 8
                y parámetros.
   - Sección 2: usuarios y su acceso por producto prioritario.
                ANTES DE EJECUTAR EN PRODUCCIÓN: reemplaza los correos de ejemplo por los
                correos reales (Microsoft Entra ID) de tu organización.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

/* ---------- 1. Datos maestros ----------------------------------------------- */

MERGE rep.perfil AS t
USING (VALUES
  ('admin',    N'Administrador', N'Responsable REP de la empresa. Acceso completo y gestión de usuarios.'),
  ('operador', N'Operador',      N'Carga los datos: importa ventas, ingresa pesos, kilos gestionados y tarifas.'),
  ('consulta', N'Consulta',      N'Gerencia o auditoría. Solo revisa y exporta informes.')
) AS s (codigo, nombre, descripcion) ON t.codigo = s.codigo
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, descripcion = s.descripcion
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion) VALUES (s.codigo, s.nombre, s.descripcion);

MERGE rep.permiso AS t
USING (VALUES
  ('sku.importar',      N'Importar ventas, catálogo y unidades'),
  ('sku.pesos',         N'Ingresar pesos de SKU'),
  ('gestion.ingresar',  N'Ingresar kilos gestionados y tarifas de gestión'),
  ('informes.ver',      N'Ver informes'),
  ('informes.exportar', N'Exportar informes (Excel / PDF / Power BI)'),
  ('usuarios.ver',      N'Ver usuarios y perfiles')
) AS s (codigo, descripcion) ON t.codigo = s.codigo
WHEN MATCHED THEN UPDATE SET descripcion = s.descripcion
WHEN NOT MATCHED THEN INSERT (codigo, descripcion) VALUES (s.codigo, s.descripcion);

MERGE rep.perfil_permiso AS t
USING (VALUES
  ('admin', 'sku.importar'), ('admin', 'sku.pesos'), ('admin', 'gestion.ingresar'), ('admin', 'informes.ver'),
  ('admin', 'informes.exportar'), ('admin', 'usuarios.ver'),
  ('operador', 'sku.importar'), ('operador', 'sku.pesos'), ('operador', 'gestion.ingresar'), ('operador', 'informes.ver'),
  ('operador', 'informes.exportar'),
  ('consulta', 'informes.ver'), ('consulta', 'informes.exportar')
) AS s (perfil_codigo, permiso_codigo) ON t.perfil_codigo = s.perfil_codigo AND t.permiso_codigo = s.permiso_codigo
WHEN NOT MATCHED BY TARGET THEN INSERT (perfil_codigo, permiso_codigo) VALUES (s.perfil_codigo, s.permiso_codigo)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

/* Los 6 productos prioritarios de la Ley REP. "configurado" = ya tiene atributos y puede usarse. */
MERGE rep.programa AS t
USING (VALUES
  ('env', N'Envases y embalajes',                1, 1, 'clase',     'material'),
  ('neu', N'Neumáticos',                         2, 1, 'categoria', 'subcategoria'),
  ('aee', N'Aparatos eléctricos y electrónicos', 3, 0, NULL,        NULL),
  ('ayl', N'Aceites y lubricantes',              4, 0, NULL,        NULL),
  ('pil', N'Pilas',                              5, 0, NULL,        NULL),
  ('tex', N'Textiles',                           6, 0, NULL,        NULL)
) AS s (id, nombre, orden, configurado, agrupador, desglose) ON t.id = s.id
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, orden = s.orden, configurado = s.configurado, agrupador = s.agrupador, desglose = s.desglose
WHEN NOT MATCHED THEN INSERT (id, nombre, orden, configurado, agrupador, desglose)
  VALUES (s.id, s.nombre, s.orden, s.configurado, s.agrupador, s.desglose);

/* La etiqueta es también el nombre de la columna en la planilla de importación y en el export. */
MERGE rep.programa_atributo AS t
USING (VALUES
  ('env', 'material',     N'Material',     1, 'texto',  1, NULL),
  ('env', 'sub',          N'Subcategoría', 2, 'texto',  0, NULL),
  ('env', 'clase',        N'Clase',        3, 'texto',  1, N'["Domiciliario","No domiciliario"]'),
  ('env', 'peligro',      N'Peligrosidad', 4, 'texto',  0, N'["Peligroso","No peligroso"]'),
  ('neu', 'marca',        N'Marca',        1, 'texto',  1, NULL),
  ('neu', 'tipo',         N'Tipo',         2, 'texto',  1, N'["Radial","Diagonal","Macizo"]'),
  ('neu', 'categoria',    N'Categoría',    3, 'texto',  1, N'["Categoría A","Categoría B"]'),
  ('neu', 'subcategoria', N'Subcategoría', 4, 'texto',  1, NULL),
  ('neu', 'aro',          N'Aro',          5, 'numero', 1, NULL),
  ('neu', 'dimension',    N'Dimensión',    6, 'texto',  1, NULL)
) AS s (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores) ON t.programa_id = s.programa_id AND t.clave = s.clave
WHEN MATCHED THEN UPDATE SET etiqueta = s.etiqueta, orden = s.orden, tipo = s.tipo, obligatorio = s.obligatorio, valores = s.valores
WHEN NOT MATCHED THEN INSERT (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores)
  VALUES (s.programa_id, s.clave, s.etiqueta, s.orden, s.tipo, s.obligatorio, s.valores);

/* Metas del DS 8/2019 (neumáticos), sobre lo introducido el año anterior.
   Categoría B solo tiene meta de valorización: la recolección se entiende cumplida con ella,
   por eso se carga el mismo porcentaje en ambos tipos. Validar con asesoría legal. */
MERGE rep.meta_legal AS t
USING (VALUES
  ('neu', N'Categoría A', 'recoleccion',  2023, 0.50), ('neu', N'Categoría A', 'recoleccion',  2026, 0.80),
  ('neu', N'Categoría A', 'recoleccion',  2030, 0.90),
  ('neu', N'Categoría A', 'valorizacion', 2023, 0.25), ('neu', N'Categoría A', 'valorizacion', 2024, 0.30),
  ('neu', N'Categoría A', 'valorizacion', 2025, 0.35), ('neu', N'Categoría A', 'valorizacion', 2026, 0.60),
  ('neu', N'Categoría A', 'valorizacion', 2028, 0.80), ('neu', N'Categoría A', 'valorizacion', 2030, 0.90),
  ('neu', N'Categoría B', 'valorizacion', 2023, 0.25), ('neu', N'Categoría B', 'valorizacion', 2027, 0.75),
  ('neu', N'Categoría B', 'valorizacion', 2030, 1.00),
  ('neu', N'Categoría B', 'recoleccion',  2023, 0.25), ('neu', N'Categoría B', 'recoleccion',  2027, 0.75),
  ('neu', N'Categoría B', 'recoleccion',  2030, 1.00)
) AS s (programa_id, categoria, tipo_meta, anio_desde, porcentaje)
  ON t.programa_id = s.programa_id AND t.categoria = s.categoria AND t.tipo_meta = s.tipo_meta AND t.anio_desde = s.anio_desde
WHEN MATCHED THEN UPDATE SET porcentaje = s.porcentaje
WHEN NOT MATCHED THEN INSERT (programa_id, categoria, tipo_meta, anio_desde, porcentaje)
  VALUES (s.programa_id, s.categoria, s.tipo_meta, s.anio_desde, s.porcentaje);

MERGE rep.parametro AS t
USING (VALUES
  ('neu', 'factor_desgaste', CAST('2023-01-01' AS date), 0.84, N'Pérdida de masa del neumático por uso (DS 8/2019)'),
  ('neu', 'iva',             CAST('2023-01-01' AS date), 0.19, N'IVA aplicado al costo de gestión')
) AS s (programa_id, clave, vigente_desde, valor, descripcion)
  ON t.programa_id = s.programa_id AND t.clave = s.clave AND t.vigente_desde = s.vigente_desde
WHEN MATCHED THEN UPDATE SET valor = s.valor, descripcion = s.descripcion
WHEN NOT MATCHED THEN INSERT (programa_id, clave, vigente_desde, valor, descripcion)
  VALUES (s.programa_id, s.clave, s.vigente_desde, s.valor, s.descripcion);

/* ---------- 2. Usuarios y acceso por producto prioritario -------------------- */

MERGE rep.usuario AS t
USING (VALUES
  (N'admin@demo.cl',    N'Administrador', 'admin'),
  (N'operador@demo.cl', N'Operador',      'operador'),
  (N'consulta@demo.cl', N'Consulta',      'consulta')
) AS s (email, nombre, perfil_codigo) ON t.email = s.email
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, perfil_codigo = s.perfil_codigo
WHEN NOT MATCHED THEN INSERT (email, nombre, perfil_codigo) VALUES (s.email, s.nombre, s.perfil_codigo);

INSERT INTO rep.usuario_programa (usuario_id, programa_id)
SELECT u.id, a.programa_id
FROM (VALUES
  (N'admin@demo.cl', 'env'), (N'admin@demo.cl', 'neu'), (N'admin@demo.cl', 'aee'),
  (N'admin@demo.cl', 'ayl'), (N'admin@demo.cl', 'pil'), (N'admin@demo.cl', 'tex'),
  (N'operador@demo.cl', 'env'), (N'operador@demo.cl', 'neu'),
  (N'consulta@demo.cl', 'neu')
) AS a (email, programa_id)
JOIN rep.usuario u ON u.email = a.email
WHERE NOT EXISTS (SELECT 1 FROM rep.usuario_programa x WHERE x.usuario_id = u.id AND x.programa_id = a.programa_id);

COMMIT TRANSACTION;
