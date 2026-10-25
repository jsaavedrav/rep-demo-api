import { Injectable, NotFoundException } from '@nestjs/common';
import { exigirAcceso } from '../auth/acceso.js';
import { UsuarioActual } from '../auth/decoradores.js';
import { validarAtributos } from '../dominio/atributos.js';
import { ErrorFila, rechazarSiHayErrores, validarCantidad } from '../importacion.js';
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
    rechazarSiHayErrores(errores);

    return this.skus.importar(items, usuario.id);
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
    return (await this.skus.actualizarPeso(id, pesoKg, usuario.id))!;
  }
}
