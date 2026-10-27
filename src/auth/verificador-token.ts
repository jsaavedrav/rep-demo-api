import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';

/** Claves públicas con que Microsoft Entra ID firma los tokens (cuentas de trabajo y personales). */
const JWKS_MICROSOFT = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const SCOPE = 'access_as_user';

/**
 * Valida el JWT (access token v2) que emite Microsoft Entra ID para esta API y devuelve el
 * correo del usuario. La aplicación acepta cualquier cuenta Microsoft; quién entra realmente
 * lo decide rep.usuario.
 */
@Injectable()
export class VerificadorToken {
  /** Reemplazable en pruebas por un conjunto de claves local. */
  claves: JWTVerifyGetKey = createRemoteJWKSet(new URL(JWKS_MICROSOFT));

  constructor(private readonly config: ConfigService) {}

  async verificar(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.claves, {
      audience: this.config.getOrThrow<string>('AUTH_CLIENT_ID'),
      algorithms: ['RS256'],
    });
    // Multi-tenant: el emisor depende del directorio del usuario, pero siempre debe ser Microsoft.
    const tid = payload['tid'];
    if (typeof tid !== 'string' || payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) {
      throw new Error('Emisor del token no válido');
    }
    if (!String(payload['scp'] ?? '').split(' ').includes(SCOPE)) throw new Error(`El token no incluye el permiso ${SCOPE}`);

    const correo = payload['preferred_username'] ?? payload['email'];
    if (typeof correo !== 'string' || !correo) throw new Error('El token no incluye el correo del usuario');
    return correo.toLowerCase();
  }
}
