import { trace } from '@opentelemetry/api';
import type { Request } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Datos de la solicitud en curso, disponibles en cualquier log sin pasarlos de mano en mano. */
export interface ContextoSolicitud {
  /** Igual al operation_Id de Application Insights cuando la telemetría está activa. */
  requestId: string;
  usuarioId?: string;
}

export const contexto = new AsyncLocalStorage<ContextoSolicitud>();

export const contextoActual = (): ContextoSolicitud | undefined => contexto.getStore();

/**
 * Nombra la traza de la solicitud con su ruta ("GET /api/programas/:programaId/skus") para que
 * Application Insights agrupe las llamadas por endpoint y no por URL concreta. Se llama desde el
 * guard global, que es lo primero que corre ya resuelta la ruta.
 */
export function nombrarSolicitud(req: Request & { route?: { path?: string } }) {
  const ruta = req.route?.path;
  if (!ruta) return;
  const span = trace.getActiveSpan();
  span?.setAttribute('http.route', ruta);
  span?.updateName(`${req.method} ${ruta}`);
}
