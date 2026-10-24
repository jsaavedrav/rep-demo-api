/* =============================================================================
   Declaración REP - Consultas de la API (referencia para el backend)
   Una sección por endpoint de src/app/core/data/api/api-repositories.ts.
   Los DECLARE simulan los parámetros que enviará la API; en el código se pasan
   como parámetros de la consulta (nunca concatenando texto, para evitar SQL injection).
   Este script es de solo prueba: las escrituras se deshacen al final (ROLLBACK).
   ============================================================================= */

SET NOCOUNT ON;
DECLARE @programa_id varchar(20)   = 'env';
DECLARE @email       nvarchar(254) = N'operador@demo.cl';
DECLARE @desde       date          = '2026-01-01';
DECLARE @hasta       date          = '2026-12-31';

BEGIN TRANSACTION;

/* ---------- POST /auth/login  (o GET /usuarios/me con Entra ID) -------------
   Usuario activo + sus permisos. Si no hay filas, no tiene acceso a la aplicación. */
SELECT u.id, u.email, u.nombre, u.perfil_codigo AS perfil,
       (SELECT STRING_AGG(pp.permiso_codigo, ',') FROM rep.perfil_permiso pp WHERE pp.perfil_codigo = u.perfil_codigo) AS permisos
FROM rep.usuario u
WHERE u.email = @email AND u.activo = 1;

/* ---------- GET /usuarios --------------------------------------------------- */
SELECT id, email, nombre, perfil_codigo AS perfil FROM rep.usuario WHERE activo = 1 ORDER BY nombre;

/* ---------- GET /programas --------------------------------------------------
   Devuelve JSON con la misma forma que el modelo Programa del frontend. */
SELECT p.id, p.nombre, p.agrupador, p.desglose,
       JSON_QUERY((
         SELECT '{' + STRING_AGG('"' + STRING_ESCAPE(a.clave, 'json') + '":"' + STRING_ESCAPE(a.etiqueta, 'json') + '"', ',')
                      WITHIN GROUP (ORDER BY a.orden) + '}'
         FROM rep.programa_atributo a WHERE a.programa_id = p.id
       )) AS atributos
FROM rep.programa p
ORDER BY p.nombre
FOR JSON PATH;

/* ---------- GET /programas/{id}/skus ---------------------------------------- */
SELECT c.id, c.programa_id AS programaId, c.sku, c.nombre, JSON_QUERY(c.atributos) AS atributos, c.peso_kg AS pesoKg
FROM rep.sku_componente c
WHERE c.programa_id = @programa_id
ORDER BY c.sku, c.nombre
FOR JSON PATH, INCLUDE_NULL_VALUES;

/* ---------- POST /skus/importar ---------------------------------------------
   La API recibe el arreglo JSON del frontend y lo pasa completo en @json.
   Crea o actualiza (por programa + SKU + componente) y devuelve los conteos. */
DECLARE @json_catalogo nvarchar(max) = N'[
  {"programaId":"env","sku":"AGU-600","nombre":"Agua 600 ml (botella)","atributos":{"material":"Plástico","sub":"PET","clase":"Domiciliario","peligro":"No peligroso"},"pesoKg":0.018},
  {"programaId":"env","sku":"BEB-500","nombre":"Bebida 500 ml (tapa)","atributos":{"material":"Plástico","sub":"PEAD","clase":"Domiciliario","peligro":"No peligroso"},"pesoKg":0.0032}
]';

DECLARE @cat TABLE (programa_id varchar(20), sku nvarchar(50), nombre nvarchar(150), atributos nvarchar(max), peso_kg decimal(14,6));
INSERT INTO @cat
SELECT programaId, sku, nombre, atributos, pesoKg
FROM OPENJSON(@json_catalogo) WITH (
  programaId varchar(20) '$.programaId', sku nvarchar(50) '$.sku', nombre nvarchar(150) '$.nombre',
  atributos nvarchar(max) '$.atributos' AS JSON, pesoKg decimal(14,6) '$.pesoKg'
);

INSERT INTO rep.sku (programa_id, sku)
SELECT DISTINCT c.programa_id, c.sku FROM @cat c
WHERE NOT EXISTS (SELECT 1 FROM rep.sku s WHERE s.programa_id = c.programa_id AND s.sku = c.sku);

DECLARE @acciones TABLE (accion nvarchar(10));
MERGE rep.sku_componente AS t
USING @cat AS s ON t.programa_id = s.programa_id AND t.sku = s.sku AND t.nombre = s.nombre
WHEN MATCHED THEN
  -- Si el Excel no trae peso, se conserva el que ya estaba ingresado.
  UPDATE SET atributos = s.atributos, peso_kg = ISNULL(s.peso_kg, t.peso_kg), actualizado_en = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (programa_id, sku, nombre, atributos, peso_kg) VALUES (s.programa_id, s.sku, s.nombre, s.atributos, s.peso_kg)
OUTPUT $action INTO @acciones;

SELECT SUM(IIF(accion = 'INSERT', 1, 0)) AS creados, SUM(IIF(accion = 'UPDATE', 1, 0)) AS actualizados FROM @acciones;

/* ---------- PATCH /skus/{id}  (ingresar peso) -------------------------------- */
DECLARE @componente_id int = (SELECT id FROM rep.sku_componente WHERE programa_id = 'env' AND sku = N'BEB-1.5L' AND nombre = N'Bebida 1,5 L (tapa)');
DECLARE @peso_kg decimal(14,6) = 0.004;

UPDATE rep.sku_componente
SET peso_kg = @peso_kg, actualizado_en = SYSUTCDATETIME(),
    actualizado_por = (SELECT id FROM rep.usuario WHERE email = @email)
OUTPUT inserted.id, inserted.programa_id AS programaId, inserted.sku, inserted.nombre, inserted.atributos, inserted.peso_kg AS pesoKg
WHERE id = @componente_id;

/* ---------- GET /programas/{id}/movimientos ---------------------------------- */
SELECT id, programa_id AS programaId, documento, CONVERT(char(10), fecha, 23) AS fecha, proveedor, sku, unidades
FROM rep.movimiento
WHERE programa_id = @programa_id
ORDER BY fecha, documento;

/* ---------- POST /movimientos/importar --------------------------------------- */
DECLARE @json_movimientos nvarchar(max) = N'[
  {"programaId":"env","documento":"DIN-2026-0600","fecha":"2026-09-15","proveedor":"Aguas SA","sku":"AGU-600","unidades":10000},
  {"programaId":"env","documento":"DIN-2026-0101","fecha":"2026-01-15","proveedor":"Proveedor Andes","sku":"BEB-500","unidades":125000}
]';

INSERT INTO rep.importacion (programa_id, tipo, origen, archivo, usuario_id)
VALUES (@programa_id, 'movimientos', 'excel', N'movimientos.csv', (SELECT id FROM rep.usuario WHERE email = @email));
DECLARE @importacion_id bigint = SCOPE_IDENTITY();

DELETE FROM @acciones;
MERGE rep.movimiento AS t
USING (
  SELECT * FROM OPENJSON(@json_movimientos) WITH (
    programaId varchar(20), documento nvarchar(50), fecha date, proveedor nvarchar(150), sku nvarchar(50), unidades int
  )
) AS s ON t.programa_id = s.programaId AND t.documento = s.documento AND t.sku = s.sku
WHEN MATCHED THEN
  UPDATE SET fecha = s.fecha, proveedor = s.proveedor, unidades = s.unidades, importacion_id = @importacion_id
WHEN NOT MATCHED THEN
  INSERT (programa_id, documento, fecha, proveedor, sku, unidades, importacion_id)
  VALUES (s.programaId, s.documento, s.fecha, s.proveedor, s.sku, s.unidades, @importacion_id)
OUTPUT $action INTO @acciones;

UPDATE rep.importacion
SET creados = (SELECT COUNT(*) FROM @acciones WHERE accion = 'INSERT'),
    actualizados = (SELECT COUNT(*) FROM @acciones WHERE accion = 'UPDATE')
OUTPUT inserted.creados, inserted.actualizados
WHERE id = @importacion_id;

/* ---------- Informes (opcional: hoy se calculan en el frontend) --------------
   Útiles si el volumen crece y conviene calcular en la base.
   Resumen declaración: kilos por desglose (filas) y agrupador (columnas). */
DECLARE @ruta_agrupador nvarchar(40), @ruta_desglose nvarchar(40);
SELECT @ruta_agrupador = '$.' + agrupador, @ruta_desglose = '$.' + desglose FROM rep.programa WHERE id = @programa_id;

SELECT JSON_VALUE(atributos, @ruta_desglose)  AS desglose,
       JSON_VALUE(atributos, @ruta_agrupador) AS agrupador,
       SUM(kilos) AS kilos
FROM rep.v_informe_kilos
WHERE programa_id = @programa_id AND fecha BETWEEN @desde AND @hasta
GROUP BY JSON_VALUE(atributos, @ruta_desglose), JSON_VALUE(atributos, @ruta_agrupador)
ORDER BY desglose, agrupador;

/* Datos pendientes: componentes sin peso con unidades en el periodo. */
SELECT c.sku, c.nombre, SUM(m.unidades) AS unidades_sin_kilos
FROM rep.sku_componente c
JOIN rep.movimiento m ON m.programa_id = c.programa_id AND m.sku = c.sku AND m.fecha BETWEEN @desde AND @hasta
WHERE c.programa_id = @programa_id AND c.peso_kg IS NULL
GROUP BY c.sku, c.nombre;

ROLLBACK TRANSACTION;  -- Solo prueba: no deja cambios.
