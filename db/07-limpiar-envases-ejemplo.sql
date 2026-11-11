/*
  Borra los movimientos, SKUs e importaciones de Envases y embalajes, para recargar los datos
  de ejemplo de la especificación con 03-dml-datos-ejemplo.sql (que es idempotente: no duplica
  lo demás). Solo para ambientes de demo: borra TODO lo cargado en envases.
  Orden en una base existente: 06 -> 07 -> 03.
*/
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

DELETE FROM rep.movimiento WHERE programa_id = 'env'; -- movimiento_componente se borra en cascada
DELETE FROM rep.sku_componente WHERE programa_id = 'env';
DELETE FROM rep.sku WHERE programa_id = 'env';
DELETE FROM rep.importacion WHERE programa_id = 'env';

COMMIT TRANSACTION;
