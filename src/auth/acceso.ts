import { ForbiddenException } from '@nestjs/common';
import { UsuarioActual } from './decoradores.js';

/** El usuario debe tener acceso al producto prioritario (rep.usuario_programa). */
export function exigirAcceso(usuario: UsuarioActual, programaId: string) {
  if (!usuario.programas.includes(programaId)) {
    throw new ForbiddenException(`Sin acceso al producto prioritario "${programaId}"`);
  }
}
