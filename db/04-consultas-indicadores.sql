/* =============================================================================
   Declaración REP - Consultas de indicadores (referencia para los dashboards)
   Implementan las fórmulas de la especificación para un programa y un año.
   Solo lectura: se puede ejecutar en cualquier momento.

   Pendiente de definir con el cliente (ver revisión de la especificación):
   - si el % de cumplimiento se mide contra la meta con o sin factor de desgaste;
   - qué tarifa usar en el costo cuando hay varias compras en el año (aquí: promedio del año).
   ============================================================================= */

SET NOCOUNT ON;
DECLARE @programa varchar(20) = 'neu';
DECLARE @anio     smallint    = 2025;        -- año de la meta; la línea base es @anio - 1
DECLARE @tipo     varchar(20) = 'recoleccion'; -- o 'valorizacion'

/* Factor de desgaste e IVA vigentes al inicio del año. */
DECLARE @fd decimal(18,6) = (
  SELECT TOP 1 valor FROM rep.parametro
  WHERE programa_id = @programa AND clave = 'factor_desgaste' AND vigente_desde <= DATEFROMPARTS(@anio, 12, 31)
  ORDER BY vigente_desde DESC);
DECLARE @iva decimal(18,6) = (
  SELECT TOP 1 valor FROM rep.parametro
  WHERE programa_id = @programa AND clave = 'iva' AND vigente_desde <= DATEFROMPARTS(@anio, 12, 31)
  ORDER BY vigente_desde DESC);

WITH
/* Kilos introducidos por categoría y año (registros pendientes de peso no suman). */
introducidos AS (
  SELECT anio_comercial AS anio, JSON_VALUE(v.atributos, '$.' + p.agrupador) AS categoria, SUM(v.kilos) AS kilos
  FROM rep.v_informe_kilos v
  JOIN rep.programa p ON p.id = v.programa_id
  WHERE v.programa_id = @programa
  GROUP BY anio_comercial, JSON_VALUE(v.atributos, '$.' + p.agrupador)
),
/* Meta vigente: la fila con el mayor anio_desde que no supere el año. */
meta AS (
  SELECT m.categoria, m.porcentaje
  FROM rep.meta_legal m
  WHERE m.programa_id = @programa AND m.tipo_meta = @tipo
    AND m.anio_desde = (SELECT MAX(x.anio_desde) FROM rep.meta_legal x
                        WHERE x.programa_id = m.programa_id AND x.categoria = m.categoria
                          AND x.tipo_meta = m.tipo_meta AND x.anio_desde <= @anio)
),
gestionados AS (
  SELECT categoria, SUM(kilos) AS kilos FROM rep.gestion
  WHERE programa_id = @programa AND anio = @anio AND tipo_meta = @tipo GROUP BY categoria
),
tarifa AS (
  SELECT categoria, AVG(precio_kg_clp) AS precio_kg_clp FROM rep.tarifa_gestion
  WHERE programa_id = @programa AND YEAR(fecha) = @anio GROUP BY categoria
)
SELECT
  m.categoria,
  ISNULL(act.kilos, 0)                              AS kilos_introducidos_anio,      -- KPI "Kilos introducidos"
  ISNULL(lb.kilos, 0)                               AS linea_base_kg,                -- Kgt-1
  ISNULL(lb.kilos, 0) / 1000                        AS linea_base_toneladas,         -- "Total línea base a declarar"
  m.porcentaje                                      AS meta_pct,
  ISNULL(lb.kilos, 0) * m.porcentaje                AS meta_kg,
  ISNULL(lb.kilos, 0) * @fd * m.porcentaje          AS meta_kg_con_desgaste,         -- "Kilos meta exigidos (con factor de desgaste)"
  ISNULL(g.kilos, 0)                                AS kilos_gestionados,
  ISNULL(g.kilos, 0) / NULLIF(ISNULL(lb.kilos, 0) * m.porcentaje, 0)        AS cumplimiento_sin_desgaste,
  ISNULL(g.kilos, 0) / NULLIF(ISNULL(lb.kilos, 0) * @fd * m.porcentaje, 0)  AS cumplimiento_con_desgaste,
  t.precio_kg_clp,
  ISNULL(lb.kilos, 0) * @fd * m.porcentaje * t.precio_kg_clp * (1 + @iva)  AS costo_con_iva_clp  -- (Kgt-1 × FD × %Mt × T) × 1,19
FROM meta m
LEFT JOIN introducidos lb  ON lb.categoria = m.categoria AND lb.anio = @anio - 1
LEFT JOIN introducidos act ON act.categoria = m.categoria AND act.anio = @anio
LEFT JOIN gestionados g    ON g.categoria = m.categoria
LEFT JOIN tarifa t         ON t.categoria = m.categoria
ORDER BY m.categoria;
