import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Programa } from '../dominio/models.js';

@Injectable()
export class ProgramasRepository {
  constructor(private readonly db: DatabaseService) {}

  async listar(): Promise<Programa[]> {
    const r = await (await this.db.request()).query(`
      SELECT p.id, p.nombre, p.agrupador, p.desglose, a.clave, a.etiqueta
      FROM rep.programa p
      LEFT JOIN rep.programa_atributo a ON a.programa_id = p.id
      ORDER BY p.nombre, a.orden`);

    const programas = new Map<string, Programa>();
    for (const f of r.recordset) {
      const p: Programa = programas.get(f.id) ?? { id: f.id, nombre: f.nombre, agrupador: f.agrupador, desglose: f.desglose, atributos: {} };
      if (f.clave) p.atributos[f.clave] = f.etiqueta;
      programas.set(f.id, p);
    }
    return [...programas.values()];
  }

  async obtener(id: string): Promise<Programa | undefined> {
    return (await this.listar()).find((p) => p.id === id);
  }
}
