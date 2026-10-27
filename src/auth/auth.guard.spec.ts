import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { UsuariosRepository } from '../usuarios/usuarios.repository.js';
import { AuthGuard } from './auth.guard.js';
import { PERMISOS, PUBLICO, UsuarioActual } from './decoradores.js';
import { VerificadorToken } from './verificador-token.js';

const CLIENT_ID = 'b298bb74-0000-0000-0000-000000000000';
const TID = '9188040d-6c67-4c5b-b112-36a304b66dad';

const operador: UsuarioActual = {
  id: '2', email: 'operador@demo.cl', nombre: 'Operador', perfil: 'operador', programas: ['env', 'neu'],
  permisos: ['sku.importar', 'sku.pesos', 'informes.ver', 'informes.exportar'],
};

// Par de claves propio: simula a Microsoft firmando tokens.
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const otro = await generateKeyPair('RS256');

async function token(claims: Record<string, unknown> = {}, opciones: { clave?: CryptoKey; aud?: string; exp?: string } = {}) {
  return new SignJWT({ tid: TID, scp: 'access_as_user', preferred_username: 'Operador@Demo.cl', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://login.microsoftonline.com/${TID}/v2.0`)
    .setAudience(opciones.aud ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(opciones.exp ?? '1h')
    .sign(opciones.clave ?? privateKey);
}

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
  const config = {
    get: (k: string) => env[k],
    getOrThrow: (k: string) => ({ AUTH_CLIENT_ID: CLIENT_ID, ...env })[k],
  } as unknown as ConfigService;
  const verificador = new VerificadorToken(config);
  verificador.claves = createLocalJWKSet({ keys: [jwk] });
  return new AuthGuard(reflector, usuarios, config, verificador);
}

const bearer = async (t: Promise<string>) => ({ authorization: `Bearer ${await t}` });

describe('AuthGuard con JWT de Microsoft Entra ID', () => {
  it('deja pasar endpoints públicos sin token', async () => {
    const { ctx, reflector } = contexto({}, { [PUBLICO]: true });
    await expect(guard(reflector).canActivate(ctx)).resolves.toBe(true);
  });

  it('acepta un token válido, toma el correo sin importar mayúsculas y adjunta el usuario', async () => {
    const { ctx, req, reflector } = contexto(await bearer(token()), { [PERMISOS]: ['sku.pesos'] });
    await expect(guard(reflector).canActivate(ctx)).resolves.toBe(true);
    expect(req.usuario).toEqual(operador);
  });

  it('rechaza con 401: sin token, firma ajena, otra audiencia, expirado, sin el scope o emisor ajeno', async () => {
    const casos = [
      {},
      await bearer(token({}, { clave: otro.privateKey })),
      await bearer(token({}, { aud: 'otra-api' })),
      await bearer(token({}, { exp: '-1m' })),
      await bearer(token({ scp: 'User.Read' })),
      await bearer(token({ tid: 'otro-tenant' })),
    ];
    for (const headers of casos) {
      const { ctx, reflector } = contexto(headers);
      await expect(guard(reflector).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('rechaza con 403 un correo válido que no está en rep.usuario', async () => {
    const { ctx, reflector } = contexto(await bearer(token({ preferred_username: 'otro@empresa.cl' })));
    await expect(guard(reflector).canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 403 si falta un permiso', async () => {
    const { ctx, reflector } = contexto(await bearer(token()), { [PERMISOS]: ['usuarios.ver'] });
    await expect(guard(reflector).canActivate(ctx)).rejects.toThrow('Requiere permiso: usuarios.ver');
  });

  it('usa DEV_USER_EMAIL sin token solo fuera de producción', async () => {
    const dev = contexto({});
    await expect(guard(dev.reflector, { DEV_USER_EMAIL: operador.email }).canActivate(dev.ctx)).resolves.toBe(true);
    const prod = contexto({});
    await expect(
      guard(prod.reflector, { DEV_USER_EMAIL: operador.email, NODE_ENV: 'production' }).canActivate(prod.ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
