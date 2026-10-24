import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../database/database.service.js';
import { Movimiento, ResultadoImportacion } from '../dominio/models.js';
import { NuevoMovimientoDto } from './movimientos.dto.js';

@Injectable()
export class MovimientosRepository {
  constructor(private readonly db: DatabaseService) {}

  async listar(programaId: string): Promise<Movimiento[]> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .query(`
        SELECT id, programa_id AS programaId, documento, CONVERT(char(10), fecha, 23) AS fecha, proveedor, sku, unidades
        FROM rep.movimiento
        WHERE programa_id = @programa_id
        ORDER BY fecha, documento`);
    return r.recordset.map((f) => ({ ...f, id: String(f.id) }));
  }

  /** SKUs del catálogo, para validar las unidades antes de importarlas. */
  async skusExistentes(programaId: string): Promise<Set<string>> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .query(`SELECT sku FROM rep.sku WHERE programa_id = @programa_id`);
    return new Set(r.recordset.map((f) => f.sku));
  }

  /** Crea o actualiza (por programa + documento + SKU) y registra la importación. */
  importar(programaId: string, items: NuevoMovimientoDto[], usuarioId: string): Promise<ResultadoImportacion> {
    return this.db.transaccion(async (tx) => {
      const r = await (await this.db.request(tx))
        .input('programa_id', sql.VarChar(20), programaId)
        .input('json', sql.NVarChar(sql.MAX), JSON.stringify(items))
        .input('usuario_id', sql.Int, Number(usuarioId))
        .query(`
          INSERT INTO rep.importacion (programa_id, tipo, origen, usuario_id)
          VALUES (@programa_id, 'movimientos', 'excel', @usuario_id);
          DECLARE @importacion_id bigint = SCOPE_IDENTITY();

          DECLARE @acciones TABLE (accion nvarchar(10));
          MERGE rep.movimiento AS t
          USING (
            SELECT * FROM OPENJSON(@json) WITH (
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
          WHERE id = @importacion_id;`);
      return r.recordset[0];
    });
  }
}
