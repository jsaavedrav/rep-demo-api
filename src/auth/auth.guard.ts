import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Permiso } from '../dominio/models.js';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { PERMISOS, PUBLICO, UsuarioActual } from './decoradores.js';
import { VerificadorToken } from './verificador-token.js';

/**
 * Se aplica a todos los endpoints (salvo los marcados con @Publico()).
 * - Autenticación: JWT emitido por Microsoft Entra ID en el header `Authorization: Bearer ...`.
 * - Autorización: el correo del token debe existir y estar activo en rep.usuario, y su perfil
 *   debe tener los permisos que declara el endpoint con @RequierePermiso().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly usuarios: UsuariosRepository,
    private readonly config: ConfigService,
    private readonly verificador: VerificadorToken,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destino)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioActual }>();
    const email = await this.emailDe(req);

    const usuario = await this.usuarios.buscarActivoPorEmail(email);
    if (!usuario) throw new ForbiddenException('El usuario no tiene acceso a la aplicación');
    req.usuario = usuario;

    const requeridos = this.reflector.getAllAndOverride<Permiso[] | undefined>(PERMISOS, destino) ?? [];
    const faltan = requeridos.filter((p) => !usuario.permisos.includes(p));
    if (faltan.length) throw new ForbiddenException(`Requiere permiso: ${faltan.join(', ')}`);
    return true;
  }

  private async emailDe(req: Request): Promise<string> {
    const [tipo, token] = (req.header('authorization') ?? '').split(' ');
    if (tipo?.toLowerCase() === 'bearer' && token) {
      try {
        return await this.verificador.verificar(token);
      } catch (e) {
        this.logger.warn(`Token rechazado: ${(e as Error).message}`);
        throw new UnauthorizedException('Sesión no válida o expirada');
      }
    }
    // Solo desarrollo local sin login: usuario simulado. Nunca en producción.
    const dev = this.config.get<string>('DEV_USER_EMAIL');
    if (dev && this.config.get<string>('NODE_ENV') !== 'production') return dev.toLowerCase();
    throw new UnauthorizedException('Sesión no iniciada');
  }
}
