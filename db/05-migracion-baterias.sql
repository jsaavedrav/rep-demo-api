/*
  Migración para bases ya creadas (2026-11): corrige los productos prioritarios 3 y 5.
  - 3 'aee': "Aparatos eléctricos y electrónicos" -> "Pilas, artículos eléctricos y electrónicos"
  - 5 'pil' (Pilas) -> 'bat' (Baterías); los accesos de usuarios pasan al nuevo id.
  Idempotente: se puede ejecutar más de una vez. Bases nuevas no la necesitan (02 ya trae los nombres).
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE rep.programa SET nombre = N'Pilas, artículos eléctricos y electrónicos' WHERE id = 'aee';

IF NOT EXISTS (SELECT 1 FROM rep.programa WHERE id = 'bat')
  INSERT INTO rep.programa (id, nombre, orden, configurado, agrupador, desglose)
  VALUES ('bat', N'Baterías', 5, 0, NULL, NULL);

IF EXISTS (SELECT 1 FROM rep.programa WHERE id = 'pil')
BEGIN
  INSERT INTO rep.usuario_programa (usuario_id, programa_id)
  SELECT up.usuario_id, 'bat' FROM rep.usuario_programa up
  WHERE up.programa_id = 'pil'
    AND NOT EXISTS (SELECT 1 FROM rep.usuario_programa x WHERE x.usuario_id = up.usuario_id AND x.programa_id = 'bat');
  DELETE FROM rep.usuario_programa WHERE programa_id = 'pil';
  DELETE FROM rep.programa_atributo WHERE programa_id = 'pil';
  DELETE FROM rep.programa WHERE id = 'pil';
END;

COMMIT;
