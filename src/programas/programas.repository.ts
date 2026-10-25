import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Programa } from '../dominio/models.js';

/** Programa sin el dato `acceso`, que depende del usuario. */
export type DefinicionPrograma = Omit<Programa, 'acceso'>;

@Injectable()
export class ProgramasRepository {
  constructor(private readonly db: DatabaseService) {}

  async listar(): Promise<DefinicionPrograma[]> {
    const r = await (await this.db.request()).query(`
      SELECT p.id, p.nombre, p.orden, p.configurado, p.agrupador, p.desglose,
             a.clave, a.etiqueta, a.tipo, a.obligatorio, a.valores
      FROM rep.programa p
      LEFT JOIN rep.programa_atributo a ON a.programa_id = p.id
      ORDER BY p.orden, a.orden`);

    const programas = new Map<string, DefinicionPrograma>();
    for (const f of r.recordset) {
      const p: DefinicionPrograma = programas.get(f.id) ?? {
        id: f.id, nombre: f.nombre, orden: f.orden, configurado: f.configurado,
        agrupador: f.agrupador ?? '', desglose: f.desglose ?? '', atributos: {}, definicionAtributos: [],
      };
      if (f.clave) {
        p.atributos[f.clave] = f.etiqueta;
        p.definicionAtributos.push({
          clave: f.clave, etiqueta: f.etiqueta, tipo: f.tipo, obligatorio: f.obligatorio,
          valores: f.valores ? JSON.parse(f.valores) : null,
        });
      }
      programas.set(f.id, p);
    }
    return [...programas.values()];
  }

  async obtener(id: string): Promise<DefinicionPrograma | undefined> {
    return (await this.listar()).find((p) => p.id === id);
  }
}
