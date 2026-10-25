import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../database/database.service.js';
import { Gestion, MetaLegal, Parametro, Tarifa } from '../dominio/models.js';
import { NuevaGestionDto, NuevaTarifaDto } from './gestion.dto.js';

const GESTION = `id, programa_id AS programaId, anio, categoria, tipo_meta AS tipoMeta, kilos, fuente,
  CONVERT(char(10), fecha, 23) AS fecha, documento, sku, observacion`;
const TARIFA = `id, programa_id AS programaId, categoria, CONVERT(char(10), fecha, 23) AS fecha,
  precio_kg_clp AS precioKgClp, gestor, documento, observacion`;

const conId = <T extends { id: unknown }>(f: T) => ({ ...f, id: String(f.id) });

@Injectable()
export class GestionRepository {
  constructor(private readonly db: DatabaseService) {}

  async listarGestion(programaId: string): Promise<Gestion[]> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), programaId)
      .query(`SELECT ${GESTION} FROM rep.gestion WHERE programa_id = @p ORDER BY anio DESC, categoria, id`);
    return r.recordset.map(conId);
  }

  async crearGestion(g: NuevaGestionDto, usuarioId: string): Promise<Gestion> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), g.programaId)
      .input('anio', sql.SmallInt, g.anio)
      .input('categoria', sql.NVarChar(50), g.categoria)
      .input('tipo', sql.VarChar(20), g.tipoMeta)
      .input('kilos', sql.Decimal(14, 3), g.kilos)
      .input('fuente', sql.VarChar(20), g.fuente)
      .input('fecha', sql.Date, g.fecha ?? null)
      .input('documento', sql.NVarChar(100), g.documento ?? null)
      .input('sku', sql.NVarChar(50), g.sku ?? null)
      .input('observacion', sql.NVarChar(500), g.observacion ?? null)
      .input('usuario_id', sql.Int, Number(usuarioId))
      .query(`
        INSERT INTO rep.gestion (programa_id, anio, categoria, tipo_meta, kilos, fuente, fecha, documento, sku, observacion, creado_por)
        OUTPUT inserted.id
        VALUES (@p, @anio, @categoria, @tipo, @kilos, @fuente, @fecha, @documento, @sku, @observacion, @usuario_id)`);
    return (await this.obtener<Gestion>('gestion', GESTION, r.recordset[0].id))!;
  }

  async listarTarifas(programaId: string): Promise<Tarifa[]> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), programaId)
      .query(`SELECT ${TARIFA} FROM rep.tarifa_gestion WHERE programa_id = @p ORDER BY fecha DESC, categoria, id`);
    return r.recordset.map(conId);
  }

  async crearTarifa(t: NuevaTarifaDto, usuarioId: string): Promise<Tarifa> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), t.programaId)
      .input('categoria', sql.NVarChar(50), t.categoria)
      .input('fecha', sql.Date, t.fecha)
      .input('precio', sql.Decimal(14, 2), t.precioKgClp)
      .input('gestor', sql.NVarChar(150), t.gestor ?? null)
      .input('documento', sql.NVarChar(100), t.documento ?? null)
      .input('observacion', sql.NVarChar(500), t.observacion ?? null)
      .input('usuario_id', sql.Int, Number(usuarioId))
      .query(`
        INSERT INTO rep.tarifa_gestion (programa_id, categoria, fecha, precio_kg_clp, gestor, documento, observacion, creado_por)
        OUTPUT inserted.id
        VALUES (@p, @categoria, @fecha, @precio, @gestor, @documento, @observacion, @usuario_id)`);
    return (await this.obtener<Tarifa>('tarifa_gestion', TARIFA, r.recordset[0].id))!;
  }

  /** Programa al que pertenece un registro (para verificar acceso antes de borrarlo). */
  async programaDe(tabla: 'gestion' | 'tarifa_gestion', id: number): Promise<string | undefined> {
    const r = await (await this.db.request()).input('id', sql.Int, id).query(`SELECT programa_id FROM rep.${tabla} WHERE id = @id`);
    return r.recordset[0]?.programa_id;
  }

  async eliminar(tabla: 'gestion' | 'tarifa_gestion', id: number) {
    await (await this.db.request()).input('id', sql.Int, id).query(`DELETE FROM rep.${tabla} WHERE id = @id`);
  }

  async metas(programaId: string): Promise<MetaLegal[]> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), programaId)
      .query(`
        SELECT categoria, tipo_meta AS tipoMeta, anio_desde AS anioDesde, porcentaje
        FROM rep.meta_legal WHERE programa_id = @p ORDER BY categoria, tipo_meta, anio_desde`);
    return r.recordset;
  }

  async parametros(programaId: string): Promise<Parametro[]> {
    const r = await (await this.db.request())
      .input('p', sql.VarChar(20), programaId)
      .query(`
        SELECT clave, CONVERT(char(10), vigente_desde, 23) AS vigenteDesde, valor, descripcion
        FROM rep.parametro WHERE programa_id = @p ORDER BY clave, vigente_desde`);
    return r.recordset;
  }

  private async obtener<T>(tabla: string, columnas: string, id: number): Promise<T | undefined> {
    const r = await (await this.db.request()).input('id', sql.Int, id).query(`SELECT ${columnas} FROM rep.${tabla} WHERE id = @id`);
    return r.recordset[0] && (conId(r.recordset[0]) as T);
  }
}
