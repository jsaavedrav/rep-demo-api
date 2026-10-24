import { Controller, Get } from '@nestjs/common';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { UsuariosRepository } from './usuarios.repository.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosRepository) {}

  /** Usuario de la sesión actual y sus permisos (el frontend lo usa tras el login). */
  @Get('me')
  me(@UsuarioAutenticado() usuario: UsuarioActual) {
    return usuario;
  }

  @Get()
  @RequierePermiso('usuarios.ver')
  listar() {
    return this.usuarios.listar();
  }
}
