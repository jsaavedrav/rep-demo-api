import { Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores.js';
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

  async importar(items: NuevoComponenteDto[], usuario: UsuarioActual) {
    validarCantidad(items);
    const programas = new Map((await this.programas.listar()).map((p) => [p.id, p]));

    // El frontend ya valida, pero el backend nunca confía en lo que recibe.
    const errores: ErrorFila[] = [];
    items.forEach((item, i) => {
      const p = programas.get(item.programaId);
      if (!p) return errores.push({ fila: i + 1, mensaje: `Programa "${item.programaId}" no existe` });
      for (const [clave, valor] of Object.entries(item.atributos)) {
        if (!(clave in p.atributos)) errores.push({ fila: i + 1, mensaje: `Atributo "${clave}" no existe en ${p.nombre}` });
        else if (typeof valor !== 'string' || valor.length > 100) errores.push({ fila: i + 1, mensaje: `Valor inválido en "${clave}"` });
      }
      return;
    });
    rechazarSiHayErrores(errores);

    return this.skus.importar(items, usuario.id);
  }

  async actualizarPeso(id: number, pesoKg: number, usuario: UsuarioActual) {
    const c = await this.skus.actualizarPeso(id, pesoKg, usuario.id);
    if (!c) throw new NotFoundException(`Componente ${id} no existe`);
    return c;
  }
}
