/* =============================================================================
   Declaración REP - Datos iniciales (DML)
   Ejecutar después de 01-ddl.sql. Idempotente: se puede correr varias veces.
   - Sección 1 (perfiles, permisos, programas): datos maestros, necesarios en producción.
   - Sección 2 (usuarios): reemplaza los correos por los de tu organización.
   - Sección 3 (catálogo y movimientos): datos de ejemplo del demo; omitir en producción.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ---------- 1. Datos maestros ----------------------------------------------- */

MERGE rep.perfil AS t
USING (VALUES
  ('admin',    N'Administrador', N'Responsable REP de la empresa. Acceso completo y gestión de usuarios.'),
  ('operador', N'Operador',      N'Carga los datos: importa productos y unidades, e ingresa los pesos.'),
  ('consulta', N'Consulta',      N'Gerencia o auditoría. Solo revisa y exporta informes.')
) AS s (codigo, nombre, descripcion) ON t.codigo = s.codigo
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, descripcion = s.descripcion
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion) VALUES (s.codigo, s.nombre, s.descripcion);

MERGE rep.permiso AS t
USING (VALUES
  ('sku.importar',      N'Importar catálogo y unidades'),
  ('sku.pesos',         N'Ingresar pesos de SKU'),
  ('informes.ver',      N'Ver informes'),
  ('informes.exportar', N'Exportar informes (Excel / PDF)'),
  ('usuarios.ver',      N'Ver usuarios y perfiles')
) AS s (codigo, descripcion) ON t.codigo = s.codigo
WHEN MATCHED THEN UPDATE SET descripcion = s.descripcion
WHEN NOT MATCHED THEN INSERT (codigo, descripcion) VALUES (s.codigo, s.descripcion);

MERGE rep.perfil_permiso AS t
USING (VALUES
  ('admin', 'sku.importar'), ('admin', 'sku.pesos'), ('admin', 'informes.ver'), ('admin', 'informes.exportar'), ('admin', 'usuarios.ver'),
  ('operador', 'sku.importar'), ('operador', 'sku.pesos'), ('operador', 'informes.ver'), ('operador', 'informes.exportar'),
  ('consulta', 'informes.ver'), ('consulta', 'informes.exportar')
) AS s (perfil_codigo, permiso_codigo) ON t.perfil_codigo = s.perfil_codigo AND t.permiso_codigo = s.permiso_codigo
WHEN NOT MATCHED BY TARGET THEN INSERT (perfil_codigo, permiso_codigo) VALUES (s.perfil_codigo, s.permiso_codigo)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

MERGE rep.programa AS t
USING (VALUES
  ('env', N'Envases y embalajes (DS12)', 'clase', 'material'),
  ('neu', N'Neumáticos',                 'cat',   'sub')
) AS s (id, nombre, agrupador, desglose) ON t.id = s.id
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, agrupador = s.agrupador, desglose = s.desglose
WHEN NOT MATCHED THEN INSERT (id, nombre, agrupador, desglose) VALUES (s.id, s.nombre, s.agrupador, s.desglose);

MERGE rep.programa_atributo AS t
USING (VALUES
  ('env', 'material', N'Material',     1),
  ('env', 'sub',      N'Subcategoría', 2),
  ('env', 'clase',    N'Clase',        3),
  ('env', 'peligro',  N'Peligrosidad', 4),
  ('neu', 'cat',      N'Categoría',    1),
  ('neu', 'sub',      N'Subcategoría', 2),
  ('neu', 'dim',      N'Dimensión',    3)
) AS s (programa_id, clave, etiqueta, orden) ON t.programa_id = s.programa_id AND t.clave = s.clave
WHEN MATCHED THEN UPDATE SET etiqueta = s.etiqueta, orden = s.orden
WHEN NOT MATCHED THEN INSERT (programa_id, clave, etiqueta, orden) VALUES (s.programa_id, s.clave, s.etiqueta, s.orden);

/* ---------- 2. Usuarios (reemplazar por correos reales de Entra ID) --------- */

MERGE rep.usuario AS t
USING (VALUES
  (N'admin@demo.cl',    N'Administrador', 'admin'),
  (N'operador@demo.cl', N'Operador',      'operador'),
  (N'consulta@demo.cl', N'Consulta',      'consulta')
) AS s (email, nombre, perfil_codigo) ON t.email = s.email
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, perfil_codigo = s.perfil_codigo
WHEN NOT MATCHED THEN INSERT (email, nombre, perfil_codigo) VALUES (s.email, s.nombre, s.perfil_codigo);

/* ---------- 3. Datos de ejemplo (omitir en producción) ---------------------- */

DECLARE @componentes TABLE (programa_id varchar(20), sku nvarchar(50), nombre nvarchar(150), atributos nvarchar(max), peso_kg decimal(14,6));
INSERT INTO @componentes VALUES
  ('env', N'BEB-500',  N'Bebida 500 ml (botella)', N'{"material":"Plástico","sub":"PET","clase":"Domiciliario","peligro":"No peligroso"}', 0.022),
  ('env', N'BEB-500',  N'Bebida 500 ml (tapa)',    N'{"material":"Plástico","sub":"PEAD","clase":"Domiciliario","peligro":"No peligroso"}', 0.003),
  ('env', N'JUG-1L',   N'Jugo 1 L',                N'{"material":"Cartón para líquidos","sub":"Multicapa","clase":"Domiciliario","peligro":"No peligroso"}', 0.028),
  ('env', N'CON-330',  N'Conserva 330 g',          N'{"material":"Metal","sub":"Acero","clase":"Domiciliario","peligro":"No peligroso"}', 0.05),
  ('env', N'VIN-750',  N'Vino 750 ml',             N'{"material":"Vidrio","sub":"Vidrio","clase":"Domiciliario","peligro":"No peligroso"}', 0.45),
  ('env', N'AGR-20L',  N'Agroquímico 20 L',        N'{"material":"Plástico","sub":"PEAD","clase":"No domiciliario","peligro":"Peligroso"}', 0.9),
  ('env', N'CAJ-EMB',  N'Caja de embalaje',        N'{"material":"Papel y cartón","sub":"Corrugado","clase":"No domiciliario","peligro":"No peligroso"}', 0.45),
  ('env', N'BEB-1.5L', N'Bebida 1,5 L (botella)',  N'{"material":"Plástico","sub":"PET","clase":"Domiciliario","peligro":"No peligroso"}', NULL),
  ('env', N'BEB-1.5L', N'Bebida 1,5 L (tapa)',     N'{"material":"Plástico","sub":"PEAD","clase":"Domiciliario","peligro":"No peligroso"}', NULL),
  ('neu', N'NEU-205',  N'Neumático auto',          N'{"cat":"A","sub":"Radial","dim":"205/55 R16"}', 8.5),
  ('neu', N'NEU-265',  N'Neumático SUV',           N'{"cat":"A","sub":"Radial","dim":"265/65 R17"}', 14),
  ('neu', N'NEU-MAC',  N'Neumático macizo',        N'{"cat":"A","sub":"Macizo","dim":"6.50-10"}', 17),
  ('neu', N'NEU-MIN',  N'Neumático minero',        N'{"cat":"B","sub":"Radial","dim":"40.00 R57"}', 1250),
  ('neu', N'NEU-CAM',  N'Neumático camión',        N'{"cat":"A","sub":"Radial","dim":"295/80 R22.5"}', NULL);

INSERT INTO rep.sku (programa_id, sku)
SELECT DISTINCT c.programa_id, c.sku FROM @componentes c
WHERE NOT EXISTS (SELECT 1 FROM rep.sku s WHERE s.programa_id = c.programa_id AND s.sku = c.sku);

INSERT INTO rep.sku_componente (programa_id, sku, nombre, atributos, peso_kg)
SELECT c.programa_id, c.sku, c.nombre, c.atributos, c.peso_kg FROM @componentes c
WHERE NOT EXISTS (
  SELECT 1 FROM rep.sku_componente x WHERE x.programa_id = c.programa_id AND x.sku = c.sku AND x.nombre = c.nombre
);

INSERT INTO rep.movimiento (programa_id, documento, fecha, proveedor, sku, unidades)
SELECT s.programa_id, s.documento, s.fecha, s.proveedor, s.sku, s.unidades
FROM (VALUES
  ('env', N'DIN-2026-0101', CAST('2026-01-15' AS date), N'Proveedor Andes',    N'BEB-500',  120000),
  ('env', N'DIN-2026-0102', CAST('2026-02-03' AS date), N'Proveedor Andes',    N'JUG-1L',    80000),
  ('env', N'DIN-2026-0187', CAST('2026-03-12' AS date), N'Vidrios del Sur',    N'VIN-750',   40000),
  ('env', N'DIN-2026-0230', CAST('2026-04-20' AS date), N'Agro Import',        N'AGR-20L',    3500),
  ('env', N'DIN-2026-0311', CAST('2026-05-09' AS date), N'Metalpack',          N'CON-330',  150000),
  ('env', N'DIN-2026-0355', CAST('2026-07-01' AS date), N'Cartonera Pacífico', N'CAJ-EMB',   25000),
  ('env', N'DIN-2026-0390', CAST('2026-08-14' AS date), N'Proveedor Andes',    N'BEB-1.5L',  60000),
  ('neu', N'DIN-2026-0410', CAST('2026-01-22' AS date), N'Tire Import',        N'NEU-205',    5000),
  ('neu', N'DIN-2026-0411', CAST('2026-03-05' AS date), N'Tire Import',        N'NEU-265',    2200),
  ('neu', N'DIN-2026-0502', CAST('2026-05-18' AS date), N'Heavy Wheels',       N'NEU-MIN',      40),
  ('neu', N'DIN-2026-0540', CAST('2026-08-02' AS date), N'Logimac',            N'NEU-MAC',     900)
) AS s (programa_id, documento, fecha, proveedor, sku, unidades)
WHERE NOT EXISTS (
  SELECT 1 FROM rep.movimiento m WHERE m.programa_id = s.programa_id AND m.documento = s.documento AND m.sku = s.sku
);

COMMIT TRANSACTION;
