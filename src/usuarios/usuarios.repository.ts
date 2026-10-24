import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { UsuarioActual } from '../auth/decoradores.js';
import { DatabaseService } from '../database/database.service.js';
import { Permiso, Usuario } from '../dominio/models.js';

@Injectable()
export class UsuariosRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Usuario activo con sus permisos, o `null` si no tiene acceso. */
  async buscarActivoPorEmail(email: string): Promise<UsuarioActual | null> {
    const r = await (await this.db.request())
      .input('email', sql.NVarChar(254), email)
      .query(`
        SELECT u.id, u.email, u.nombre, u.perfil_codigo AS perfil,
               (SELECT STRING_AGG(pp.permiso_codigo, ',') FROM rep.perfil_permiso pp
                WHERE pp.perfil_codigo = u.perfil_codigo) AS permisos
        FROM rep.usuario u
        WHERE u.email = @email AND u.activo = 1`);
    const u = r.recordset[0];
    if (!u) return null;
    return { ...u, id: String(u.id), permisos: (u.permisos ?? '').split(',').filter(Boolean) as Permiso[] };
  }

  async listar(): Promise<Usuario[]> {
    const r = await (await this.db.request()).query(`
      SELECT id, email, nombre, perfil_codigo AS perfil FROM rep.usuario WHERE activo = 1 ORDER BY nombre`);
    return r.recordset.map((u) => ({ ...u, id: String(u.id) }));
  }
}
