import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Permiso } from '../dominio/models.js';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { PERMISOS, PUBLICO, UsuarioActual } from './decoradores.js';
import { leerPrincipal } from './principal.js';

/**
 * Se aplica a todos los endpoints (salvo los marcados con @Publico()).
 * - Autenticación: la hace Microsoft Entra ID a través de Static Web Apps; aquí solo se lee el correo.
 * - Autorización: el correo debe existir y estar activo en rep.usuario, y su perfil debe tener
 *   los permisos que declara el endpoint con @RequierePermiso().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usuarios: UsuariosRepository,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destino)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioActual }>();
    const email = this.emailDe(req);
    if (!email) throw new UnauthorizedException('Sesión no iniciada');

    const usuario = await this.usuarios.buscarActivoPorEmail(email);
    if (!usuario) throw new ForbiddenException('El usuario no tiene acceso a la aplicación');
    req.usuario = usuario;

    const requeridos = this.reflector.getAllAndOverride<Permiso[] | undefined>(PERMISOS, destino) ?? [];
    const faltan = requeridos.filter((p) => !usuario.permisos.includes(p));
    if (faltan.length) throw new ForbiddenException(`Requiere permiso: ${faltan.join(', ')}`);
    return true;
  }

  private emailDe(req: Request): string | null {
    const principal = leerPrincipal(req.header('x-ms-client-principal'));
    if (principal) return principal.userDetails.toLowerCase();
    // Solo desarrollo local, sin Static Web Apps delante. Nunca en producción.
    const dev = this.config.get<string>('DEV_USER_EMAIL');
    return dev && this.config.get<string>('NODE_ENV') !== 'production' ? dev.toLowerCase() : null;
  }
}
