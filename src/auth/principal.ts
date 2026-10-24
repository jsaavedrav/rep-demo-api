/**
 * Usuario autenticado que Azure Static Web Apps envía al backend enlazado
 * en el header `x-ms-client-principal` (JSON codificado en base64).
 */
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string; // correo con el que inició sesión
  userRoles: string[];
}

export function leerPrincipal(header: string | undefined): ClientPrincipal | null {
  if (!header) return null;
  try {
    const p = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return typeof p?.userDetails === 'string' && p.userDetails ? p : null;
  } catch {
    return null;
  }
}
