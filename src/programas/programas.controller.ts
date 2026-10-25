import { Controller, Get } from '@nestjs/common';
import { UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { ProgramasRepository } from './programas.repository.js';

@Controller('programas')
export class ProgramasController {
  constructor(private readonly programas: ProgramasRepository) {}

  /** Los 6 productos prioritarios, indicando a cuáles tiene acceso el usuario (el resto se muestra deshabilitado). */
  @Get()
  async listar(@UsuarioAutenticado() usuario: UsuarioActual) {
    return (await this.programas.listar()).map((p) => ({ ...p, acceso: usuario.programas.includes(p.id) }));
  }
}
