import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Permiso, Usuario } from '../dominio/models.js';

export const PUBLICO = 'publico';
export const PERMISOS = 'permisos';

export interface UsuarioActual extends Usuario {
  permisos: Permiso[];
}

/** Endpoint accesible sin sesión (ej: health check). */
export const Publico = () => SetMetadata(PUBLICO, true);

/** El usuario debe tener todos los permisos indicados. */
export const RequierePermiso = (...permisos: Permiso[]) => SetMetadata(PERMISOS, permisos);

/** Inyecta el usuario autenticado en el parámetro del controlador. */
export const UsuarioAutenticado = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual => ctx.switchToHttp().getRequest().usuario,
);
