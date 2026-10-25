import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { AuthGuard } from './auth.guard.js';
import { PERMISOS, PUBLICO, UsuarioActual } from './decoradores.js';

const operador: UsuarioActual = {
  id: '2', email: 'operador@demo.cl', nombre: 'Operador', perfil: 'operador', programas: ['env', 'neu'],
  permisos: ['sku.importar', 'sku.pesos', 'informes.ver', 'informes.exportar'],
};

const principal = (email: string) =>
  Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: 'x', userDetails: email, userRoles: [] })).toString('base64');

function contexto(headers: Record<string, string>, metadata: Record<string, unknown> = {}) {
  const req: any = { header: (n: string) => headers[n.toLowerCase()] };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
  return { ctx, req, reflector };
}

function guard(reflector: Reflector, env: Record<string, string> = {}) {
  const usuarios = {
    buscarActivoPorEmail: async (email: string) => (email === operador.email ? operador : null),
  } as unknown as UsuariosRepository;
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new AuthGuard(reflector, usuarios, config);
}

describe('AuthGuard', () => {
  it('deja pasar endpoints públicos sin sesión', async () => {
    const { ctx, reflector } = contexto({}, { [PUBLICO]: true });
    await expect(guard(reflector).canActivate(ctx)).resolves.toBe(true);
  });

  it('rechaza sin sesión con 401', async () => {
    const { ctx, reflector } = contexto({});
    await expect(guard(reflector).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 403 un correo que no está en rep.usuario', async () => {
    const { ctx, reflector } = contexto({ 'x-ms-client-principal': principal('otro@empresa.cl') });
    await expect(guard(reflector).canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autentica por el header de Static Web Apps (sin importar mayúsculas) y adjunta el usuario', async () => {
    const { ctx, req, reflector } = contexto({ 'x-ms-client-principal': principal('Operador@Demo.cl') }, { [PERMISOS]: ['sku.pesos'] });
    await expect(guard(reflector).canActivate(ctx)).resolves.toBe(true);
    expect(req.usuario).toEqual(operador);
  });

  it('rechaza con 403 si falta un permiso', async () => {
    const { ctx, reflector } = contexto({ 'x-ms-client-principal': principal(operador.email) }, { [PERMISOS]: ['usuarios.ver'] });
    await expect(guard(reflector).canActivate(ctx)).rejects.toThrow('Requiere permiso: usuarios.ver');
  });

  it('usa DEV_USER_EMAIL solo fuera de producción', async () => {
    const dev = contexto({});
    await expect(guard(dev.reflector, { DEV_USER_EMAIL: operador.email }).canActivate(dev.ctx)).resolves.toBe(true);

    const prod = contexto({});
    await expect(
      guard(prod.reflector, { DEV_USER_EMAIL: operador.email, NODE_ENV: 'production' }).canActivate(prod.ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
