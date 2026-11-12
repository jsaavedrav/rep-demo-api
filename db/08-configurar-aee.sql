/*
  Configura "Pilas, artículos eléctricos y electrónicos" (aee) según la especificación del cliente:
  - Línea base por ventas (las importaciones DIN sirven para el control de stock).
  - Cada SKU tiene un componente "Equipos" (peso neto del aparato) y uno por cada pila integrada.
  - Atributos: Línea (Equipos / Pilas) y Categoría (6 categorías de AEE y 3 tipos de pila).
  Para bases ya creadas (2026-11); las nuevas lo traen en 02. Idempotente. Después: 03 carga los datos de ejemplo.
*/
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

UPDATE rep.programa SET configurado = 1, base_calculo = 'venta', agrupador = 'linea', desglose = 'categoria' WHERE id = 'aee';

MERGE rep.programa_atributo AS t
USING (VALUES
  ('aee', 'linea',        N'Línea',          1, 'texto', 1, N'["Equipos","Pilas"]'),
  ('aee', 'categoria',    N'Categoría',      2, 'texto', 1, N'["Aparatos de intercambio de temperatura","Monitores, pantallas y aparatos con pantallas","Lámparas","Grandes aparatos (Dimensión > 50 cm)","Pequeños aparatos (Dimensión ≤ 50 cm)","Aparatos de informática y telecomunicaciones pequeños","Batería Recargable (Litio, Níquel)","Pila Botón","Pila Estándar (AA, AAA, C, D)"]')
) AS s (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores) ON t.programa_id = s.programa_id AND t.clave = s.clave
WHEN MATCHED THEN UPDATE SET etiqueta = s.etiqueta, orden = s.orden, tipo = s.tipo, obligatorio = s.obligatorio, valores = s.valores
WHEN NOT MATCHED THEN INSERT (programa_id, clave, etiqueta, orden, tipo, obligatorio, valores)
  VALUES (s.programa_id, s.clave, s.etiqueta, s.orden, s.tipo, s.obligatorio, s.valores);

COMMIT TRANSACTION;
