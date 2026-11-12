/*
  Neumáticos primero en el selector de producto (y por lo tanto el que se abre por defecto).
  Para bases creadas antes de noviembre 2026; las nuevas lo traen en 02. Idempotente.
*/
UPDATE rep.programa SET orden = CASE id WHEN 'neu' THEN 1 WHEN 'env' THEN 2 END WHERE id IN ('neu', 'env');
