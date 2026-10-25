import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { exigirAcceso } from '../auth/acceso.js';
import { UsuarioActual } from '../auth/decoradores.js';
import { ProgramasRepository } from '../programas/programas.repository.js';
import { NuevaGestionDto, NuevaTarifaDto } from './gestion.dto.js';
import { GestionRepository } from './gestion.repository.js';

@Injectable()
export class GestionService {
  constructor(
    private readonly repo: GestionRepository,
    private readonly programas: ProgramasRepository,
  ) {}

  async listarGestion(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.repo.listarGestion(programaId);
  }

  async crearGestion(dto: NuevaGestionDto, usuario: UsuarioActual) {
    await this.validarCategoria(dto.programaId, dto.categoria, usuario);
    return this.repo.crearGestion(dto, usuario.id);
  }

  async listarTarifas(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.repo.listarTarifas(programaId);
  }

  async crearTarifa(dto: NuevaTarifaDto, usuario: UsuarioActual) {
    await this.validarCategoria(dto.programaId, dto.categoria, usuario);
    return this.repo.crearTarifa(dto, usuario.id);
  }

  async eliminar(tabla: 'gestion' | 'tarifa_gestion', id: number, usuario: UsuarioActual) {
    const programaId = await this.repo.programaDe(tabla, id);
    if (!programaId) throw new NotFoundException(`Registro ${id} no existe`);
    exigirAcceso(usuario, programaId);
    await this.repo.eliminar(tabla, id);
  }

  async metas(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.repo.metas(programaId);
  }

  async parametros(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.repo.parametros(programaId);
  }

  /** La categoría debe ser un valor del atributo agrupador del programa (neumáticos: Categoría A / B). */
  private async validarCategoria(programaId: string, categoria: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    const p = await this.programas.obtener(programaId);
    if (!p) throw new BadRequestException(`Programa "${programaId}" no existe`);
    const valores = p.definicionAtributos.find((a) => a.clave === p.agrupador)?.valores;
    if (valores && !valores.includes(categoria)) {
      throw new BadRequestException(`Categoría "${categoria}" no es válida (valores: ${valores.join(', ')})`);
    }
  }
}
