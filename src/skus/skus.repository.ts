import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../database/database.service.js';
import { ResultadoImportacion, SkuComponente } from '../dominio/models.js';
import { NuevoComponenteDto } from './skus.dto.js';

const COLUMNAS = `id, programa_id AS programaId, sku, nombre, atributos, peso_kg AS pesoKg`;

const mapear = (f: any): SkuComponente => ({ ...f, id: String(f.id), atributos: JSON.parse(f.atributos) });

@Injectable()
export class SkusRepository {
  constructor(private readonly db: DatabaseService) {}

  async listar(programaId: string): Promise<SkuComponente[]> {
    const r = await (await this.db.request())
      .input('programa_id', sql.VarChar(20), programaId)
      .query(`SELECT ${COLUMNAS} FROM rep.sku_componente WHERE programa_id = @programa_id ORDER BY sku, nombre`);
    return r.recordset.map(mapear);
  }

  /** Crea o actualiza componentes (por programa + SKU + nombre) y registra la importación. */
  importar(items: NuevoComponenteDto[], usuarioId: string): Promise<ResultadoImportacion> {
    return this.db.transaccion(async (tx) => {
      const r = await (await this.db.request(tx))
        .input('json', sql.NVarChar(sql.MAX), JSON.stringify(items))
        .input('usuario_id', sql.Int, Number(usuarioId))
        .query(`
          DECLARE @cat TABLE (programa_id varchar(20), sku nvarchar(50), nombre nvarchar(150), atributos nvarchar(max), peso_kg decimal(14,6));
          INSERT INTO @cat
          SELECT programaId, sku, nombre, atributos, pesoKg
          FROM OPENJSON(@json) WITH (
            programaId varchar(20), sku nvarchar(50), nombre nvarchar(150),
            atributos nvarchar(max) '$.atributos' AS JSON, pesoKg decimal(14,6)
          );

          INSERT INTO rep.sku (programa_id, sku)
          SELECT DISTINCT c.programa_id, c.sku FROM @cat c
          WHERE NOT EXISTS (SELECT 1 FROM rep.sku s WHERE s.programa_id = c.programa_id AND s.sku = c.sku);

          DECLARE @acciones TABLE (accion nvarchar(10));
          MERGE rep.sku_componente AS t
          USING @cat AS s ON t.programa_id = s.programa_id AND t.sku = s.sku AND t.nombre = s.nombre
          WHEN MATCHED THEN
            -- Si el Excel no trae peso, se conserva el ya ingresado.
            UPDATE SET atributos = s.atributos, peso_kg = ISNULL(s.peso_kg, t.peso_kg),
                       actualizado_en = SYSUTCDATETIME(), actualizado_por = @usuario_id
          WHEN NOT MATCHED THEN
            INSERT (programa_id, sku, nombre, atributos, peso_kg, actualizado_por)
            VALUES (s.programa_id, s.sku, s.nombre, s.atributos, s.peso_kg, @usuario_id)
          OUTPUT $action INTO @acciones;

          DECLARE @creados int = (SELECT COUNT(*) FROM @acciones WHERE accion = 'INSERT');
          DECLARE @actualizados int = (SELECT COUNT(*) FROM @acciones WHERE accion = 'UPDATE');

          INSERT INTO rep.importacion (programa_id, tipo, origen, usuario_id, creados, actualizados)
          SELECT DISTINCT programa_id, 'catalogo', 'excel', @usuario_id, @creados, @actualizados FROM @cat;

          -- Los registros que esperaban el peso de estos componentes lo toman ahora.
          UPDATE mc SET peso_kg = c.peso_kg
          FROM rep.movimiento_componente mc
          JOIN rep.sku_componente c ON c.id = mc.componente_id
          JOIN @cat s ON s.programa_id = c.programa_id AND s.sku = c.sku AND s.nombre = c.nombre
          WHERE mc.peso_kg IS NULL AND c.peso_kg IS NOT NULL;

          SELECT @creados AS creados, @actualizados AS actualizados;`);
      return r.recordset[0];
    });
  }

  async programaDe(id: number): Promise<string | undefined> {
    const r = await (await this.db.request())
      .input('id', sql.Int, id)
      .query(`SELECT programa_id FROM rep.sku_componente WHERE id = @id`);
    return r.recordset[0]?.programa_id;
  }

  /**
   * Cambia el peso vigente y completa los registros PENDIENTES (sin peso) de ese componente.
   * Los registros que ya tenían peso no se tocan: cómo tratar las correcciones de peso
   * en periodos ya cargados está pendiente de definir.
   */
  actualizarPeso(id: number, pesoKg: number, usuarioId: string) {
    return this.db.transaccion(async (tx) => {
      const r = await (await this.db.request(tx))
        .input('id', sql.Int, id)
        .input('peso_kg', sql.Decimal(14, 6), pesoKg)
        .input('usuario_id', sql.Int, Number(usuarioId))
        .query(`
          UPDATE rep.sku_componente
          SET peso_kg = @peso_kg, actualizado_en = SYSUTCDATETIME(), actualizado_por = @usuario_id
          OUTPUT inserted.id, inserted.programa_id AS programaId, inserted.sku, inserted.nombre,
                 inserted.atributos, inserted.peso_kg AS pesoKg
          WHERE id = @id;

          UPDATE rep.movimiento_componente SET peso_kg = @peso_kg WHERE componente_id = @id AND peso_kg IS NULL;
          SELECT @@ROWCOUNT AS completados;`);
      const [componente, contador] = r.recordsets as any[];
      if (!componente[0]) return undefined;
      return { ...mapear(componente[0]), movimientosCompletados: contador[0].completados as number };
    });
  }
}
