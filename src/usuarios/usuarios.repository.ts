import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { UsuarioActual } from '../auth/decoradores.js';
import { DatabaseService } from '../database/database.service.js';
import { Permiso, Usuario } from '../dominio/models.js';

const lista = (csv: string | null) => (csv ?? '').split(',').filter(Boolean);

const COLUMNAS = `
  u.id, u.email, u.nombre, u.perfil_codigo AS perfil,
  (SELECT STRING_AGG(up.programa_id, ',') FROM rep.usuario_programa up WHERE up.usuario_id = u.id) AS programas`;

@Injectable()
export class UsuariosRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Usuario activo con sus permisos y productos prioritarios, o `null` si no tiene acceso. */
  async buscarActivoPorEmail(email: string): Promise<UsuarioActual | null> {
    const r = await (await this.db.request())
      .input('email', sql.NVarChar(254), email)
      .query(`
        SELECT ${COLUMNAS},
               (SELECT STRING_AGG(pp.permiso_codigo, ',') FROM rep.perfil_permiso pp
                WHERE pp.perfil_codigo = u.perfil_codigo) AS permisos
        FROM rep.usuario u
        WHERE u.email = @email AND u.activo = 1`);
    const u = r.recordset[0];
    if (!u) return null;
    return { ...u, id: String(u.id), programas: lista(u.programas), permisos: lista(u.permisos) as Permiso[] };
  }

  async listar(): Promise<Usuario[]> {
    const r = await (await this.db.request()).query(`
      SELECT ${COLUMNAS} FROM rep.usuario u WHERE u.activo = 1 ORDER BY u.nombre`);
    return r.recordset.map((u) => ({ ...u, id: String(u.id), programas: lista(u.programas) }));
  }
}
