import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../database/database.service.js';
import { Movimiento, ResultadoImportacionVentas } from '../dominio/models.js';
import { FilaVentaDto } from './ventas.dto.js';
import { FilaExport } from './exportacion.js';
import { ComponenteExistente, PlanSku } from './ventas.validacion.js';

@Injectable()
export class MovimientosRepository {
  constructor(private readonly db: DatabaseService) {}

  async listar(programaId: string): Promise<Movimiento[]> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .query(`
        SELECT m.id, m.programa_id AS programaId, m.id_origen AS idOrigen, m.documento,
               CONVERT(char(10), m.fecha, 23) AS fecha, m.sucursal_codigo AS sucursal, m.proveedor, m.sku, m.unidades,
               (SELECT mc.componente_id AS c, mc.peso_kg AS p FROM rep.movimiento_componente mc
                WHERE mc.movimiento_id = m.id FOR JSON PATH, INCLUDE_NULL_VALUES) AS pesos
        FROM rep.movimiento m
        WHERE m.programa_id = @programa_id
        ORDER BY m.fecha, m.documento`);
    return r.recordset.map((f) => ({
      ...f,
      id: String(f.id),
      pesos: Object.fromEntries(
        (JSON.parse(f.pesos ?? '[]') as { c: number; p: number | null }[]).map((x) => [String(x.c), x.p]),
      ),
    }));
  }

  async exportar(programaId: string): Promise<FilaExport[]> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .query(`
        SELECT movimiento_id, id_origen, CONVERT(char(10), fecha, 23) AS fecha, anio_comercial, documento, sku,
               componente, atributos, sucursal, peso_kg, unidades, kilos, toneladas
        FROM rep.v_informe_kilos
        WHERE programa_id = @programa_id
        ORDER BY fecha, movimiento_id, componente_id`);
    return r.recordset;
  }

  /** Componentes actuales de los SKUs indicados, para validar la planilla antes de importarla. */
  async componentesDe(programaId: string, skus: string[]): Promise<Map<string, ComponenteExistente[]>> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .input('skus', sql.NVarChar(sql.MAX), JSON.stringify([...new Set(skus)]))
      .query(`
        SELECT id, sku, nombre, atributos, peso_kg AS pesoKg FROM rep.sku_componente
        WHERE programa_id = @programa_id AND sku IN (SELECT value FROM OPENJSON(@skus))`);
    const mapa = new Map<string, ComponenteExistente[]>();
    for (const c of r.recordset) {
      const lista = mapa.get(c.sku) ?? [];
      lista.push({ id: String(c.id), nombre: c.nombre, atributos: JSON.parse(c.atributos), pesoKg: c.pesoKg });
      mapa.set(c.sku, lista);
    }
    return mapa;
  }

  /**
   * Importación unificada en una transacción: crea/actualiza SKUs, sucursales y movimientos,
   * y congela el peso de cada registro (el de la planilla, o el vigente del SKU, o pendiente).
   */
  importarVentas(
    programaId: string, filas: FilaVentaDto[], skus: PlanSku[], usuarioId: string,
  ): Promise<Omit<ResultadoImportacionVentas, 'advertencias'>> {
    return this.db.transaccion(async (tx) => {
      const r = await (await this.db.request(tx))
        .input('p', sql.VarChar(20), programaId)
        .input('usuario_id', sql.Int, Number(usuarioId))
        .input('filas', sql.NVarChar(sql.MAX), JSON.stringify(filas.map((f, i) => ({ ...f, fila: i + 1 }))))
        .input('skus', sql.NVarChar(sql.MAX), JSON.stringify(skus.map((s) => ({ ...s, atributos: JSON.stringify(s.atributos) }))))
        .query(`
          DECLARE @f TABLE (fila int, id_origen nvarchar(50), documento nvarchar(50), fecha date, sucursal nvarchar(30),
                            proveedor nvarchar(150), sku nvarchar(50), unidades int, peso_kg decimal(14,6));
          INSERT INTO @f
          SELECT fila, idOrigen, documento, fecha, sucursal, proveedor, sku, unidades, pesoKg
          FROM OPENJSON(@filas) WITH (
            fila int, idOrigen nvarchar(50), documento nvarchar(50), fecha date, sucursal nvarchar(30),
            proveedor nvarchar(150), sku nvarchar(50), unidades int, pesoKg decimal(14,6));

          DECLARE @s TABLE (sku nvarchar(50), nuevo bit, un_componente bit, nombre nvarchar(150), atributos nvarchar(max), peso_kg decimal(14,6));
          INSERT INTO @s
          SELECT sku, nuevo, unComponente, nombre, atributos, pesoKg
          FROM OPENJSON(@skus) WITH (sku nvarchar(50), nuevo bit, unComponente bit, nombre nvarchar(150), atributos nvarchar(max), pesoKg decimal(14,6));

          INSERT INTO rep.importacion (programa_id, tipo, origen, usuario_id) VALUES (@p, 'ventas', 'excel', @usuario_id);
          DECLARE @imp bigint = SCOPE_IDENTITY();

          -- 1. Sucursales nuevas (el nombre se puede completar después).
          INSERT INTO rep.sucursal (codigo, nombre)
          SELECT DISTINCT f.sucursal, f.sucursal FROM @f f
          WHERE f.sucursal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rep.sucursal s WHERE s.codigo = f.sucursal);

          -- 2. SKUs nuevos, con un componente.
          INSERT INTO rep.sku (programa_id, sku) SELECT @p, s.sku FROM @s s WHERE s.nuevo = 1;
          DECLARE @skus_nuevos int = @@ROWCOUNT;
          INSERT INTO rep.sku_componente (programa_id, sku, nombre, atributos, peso_kg, actualizado_por)
          SELECT @p, s.sku, s.nombre, s.atributos, s.peso_kg, @usuario_id FROM @s s WHERE s.nuevo = 1;

          -- 3. SKUs existentes de un componente: atributos al día; el peso vigente solo se completa si faltaba.
          UPDATE c SET nombre = s.nombre, atributos = s.atributos, peso_kg = COALESCE(c.peso_kg, s.peso_kg),
                       actualizado_en = SYSUTCDATETIME(), actualizado_por = @usuario_id
          FROM rep.sku_componente c JOIN @s s ON s.sku = c.sku
          WHERE c.programa_id = @p AND s.nuevo = 0 AND s.un_componente = 1;

          -- 4. Movimientos: crea o actualiza (por id de origen, o por DIN + SKU + fecha + sucursal).
          DECLARE @mov TABLE (fila int, movimiento_id bigint, accion nvarchar(10));
          MERGE rep.movimiento AS t
          USING @f AS s
          ON t.programa_id = @p AND (
               (s.id_origen IS NOT NULL AND t.id_origen = s.id_origen)
            OR (s.id_origen IS NULL AND t.id_origen IS NULL AND t.documento = s.documento AND t.sku = s.sku
                AND t.fecha = s.fecha AND EXISTS (SELECT t.sucursal_codigo INTERSECT SELECT s.sucursal)))
          WHEN MATCHED THEN
            UPDATE SET documento = s.documento, fecha = s.fecha, sucursal_codigo = s.sucursal, proveedor = s.proveedor,
                       sku = s.sku, unidades = s.unidades, importacion_id = @imp
          WHEN NOT MATCHED THEN
            INSERT (programa_id, id_origen, documento, fecha, sucursal_codigo, proveedor, sku, unidades, importacion_id)
            VALUES (@p, s.id_origen, s.documento, s.fecha, s.sucursal, s.proveedor, s.sku, s.unidades, @imp)
          OUTPUT s.fila, inserted.id, $action INTO @mov;

          -- Si un registro re-importado cambió de SKU, se quitan los componentes del SKU anterior.
          DELETE mc FROM rep.movimiento_componente mc
          JOIN @mov m ON m.movimiento_id = mc.movimiento_id
          JOIN rep.movimiento mv ON mv.id = mc.movimiento_id
          JOIN rep.sku_componente c ON c.id = mc.componente_id
          WHERE c.sku <> mv.sku;

          -- 5. Peso congelado por componente: el de la planilla (solo SKUs de un componente),
          --    si no el que ya tenía el registro, si no el vigente del SKU. Si no hay ninguno, queda pendiente.
          MERGE rep.movimiento_componente AS t
          USING (
            SELECT m.movimiento_id, c.id AS componente_id, c.peso_kg AS peso_vigente,
                   IIF((SELECT COUNT(*) FROM rep.sku_componente x WHERE x.programa_id = @p AND x.sku = f.sku) = 1, f.peso_kg, NULL) AS peso_fila
            FROM @mov m
            JOIN @f f ON f.fila = m.fila
            JOIN rep.sku_componente c ON c.programa_id = @p AND c.sku = f.sku
          ) AS s ON t.movimiento_id = s.movimiento_id AND t.componente_id = s.componente_id
          WHEN MATCHED THEN UPDATE SET peso_kg = COALESCE(s.peso_fila, t.peso_kg, s.peso_vigente)
          WHEN NOT MATCHED THEN INSERT (movimiento_id, componente_id, peso_kg)
            VALUES (s.movimiento_id, s.componente_id, COALESCE(s.peso_fila, s.peso_vigente));

          UPDATE rep.importacion
          SET creados = (SELECT COUNT(*) FROM @mov WHERE accion = 'INSERT'),
              actualizados = (SELECT COUNT(*) FROM @mov WHERE accion = 'UPDATE')
          WHERE id = @imp;

          SELECT (SELECT COUNT(*) FROM @mov WHERE accion = 'INSERT') AS creados,
                 (SELECT COUNT(*) FROM @mov WHERE accion = 'UPDATE') AS actualizados,
                 @skus_nuevos AS skusNuevos;

          SELECT DISTINCT CAST(c.id AS varchar(20)) AS componenteId, c.sku, c.nombre
          FROM rep.movimiento_componente mc
          JOIN @mov m ON m.movimiento_id = mc.movimiento_id
          JOIN rep.sku_componente c ON c.id = mc.componente_id
          WHERE mc.peso_kg IS NULL;`);
      const [totales, pendientes] = r.recordsets as any[];
      return { ...totales[0], pendientesPeso: pendientes };
    });
  }
}
