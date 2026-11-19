import { Injectable, NotFoundException } from '@nestjs/common';
import { exigirAcceso } from '../auth/acceso.js';
import { UsuarioActual } from '../auth/decoradores.js';
import { validarAtributos } from '../dominio/atributos.js';
import { ErrorFila, rechazarSiHayErrores, validarCantidad } from '../importacion.js';
import { cronometro, registrarEvento } from '../observabilidad/eventos.js';
import { ProgramasRepository } from '../programas/programas.repository.js';
import { NuevoComponenteDto } from './skus.dto.js';
import { SkusRepository } from './skus.repository.js';

@Injectable()
export class SkusService {
  constructor(
    private readonly skus: SkusRepository,
    private readonly programas: ProgramasRepository,
  ) {}

  /** Importación del catálogo con componentes (útil para envases: botella, tapa...). */
  async importar(items: NuevoComponenteDto[], usuario: UsuarioActual) {
    const duracion = cronometro();
    validarCantidad(items);
    const programas = new Map((await this.programas.listar()).map((p) => [p.id, p]));

    // El frontend ya valida, pero el backend nunca confía en lo que recibe.
    const errores: ErrorFila[] = [];
    items.forEach((item, i) => {
      const p = programas.get(item.programaId);
      if (!p) return errores.push({ fila: i + 1, mensaje: `Programa "${item.programaId}" no existe` });
      exigirAcceso(usuario, p.id);
      const r = validarAtributos(p.definicionAtributos, item.atributos, true);
      r.errores.forEach((mensaje) => errores.push({ fila: i + 1, mensaje }));
      item.atributos = r.valores;
      return;
    });
    const programa = [...new Set(items.map((i) => i.programaId))].join(',');
    if (errores.length) registrarEvento('importacion.rechazada', { programa, tipo: 'catalogo', filas: items.length, errores: errores.length });
    rechazarSiHayErrores(errores);

    const r = await this.skus.importar(items, usuario.id);
    registrarEvento('importacion.catalogo', { programa, filas: items.length, creados: r.creados, actualizados: r.actualizados, duracionMs: duracion() });
    return r;
  }

  async listar(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.skus.listar(programaId);
  }

  /** Ingresa el peso vigente y completa los registros que estaban pendientes de ese componente. */
  async actualizarPeso(id: number, pesoKg: number, usuario: UsuarioActual) {
    const programaId = await this.skus.programaDe(id);
    if (!programaId) throw new NotFoundException(`Componente ${id} no existe`);
    exigirAcceso(usuario, programaId);
    const r = (await this.skus.actualizarPeso(id, pesoKg, usuario.id))!;
    registrarEvento('peso.actualizado', { programa: programaId, componenteId: id });
    return r;
  }
}
