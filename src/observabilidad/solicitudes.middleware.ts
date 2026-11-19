import { Logger } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { contexto } from './contexto.js';

const logger = new Logger('HTTP');

/**
 * Asigna un requestId a cada solicitud (el traceId de OpenTelemetry si está activo, para cruzar
 * logs con Application Insights), lo devuelve en el header x-request-id y deja una línea de log
 * al terminar con método, ruta, estado y duración. El health check no se registra: lo llaman las
 * sondas de Azure y solo haría ruido.
 */
export function solicitudes(req: Request, res: Response, next: NextFunction) {
  const traza = trace.getActiveSpan()?.spanContext().traceId;
  const requestId = traza && traza !== '0'.repeat(32) ? traza : randomUUID().replaceAll('-', '');
  res.setHeader('x-request-id', requestId);

  const inicio = performance.now();
  const ctx = { requestId } as { requestId: string; usuarioId?: string };
  res.on('finish', () => {
    if (req.path.endsWith('/health')) return;
    const estado = res.statusCode;
    const datos = {
      message: `${req.method} ${req.path} ${estado}`,
      metodo: req.method,
      ruta: req.path,
      estado,
      duracionMs: Math.round(performance.now() - inicio),
      requestId,
      usuarioId: ctx.usuarioId,
    };
    if (estado >= 500) logger.error(datos);
    else if (estado >= 400) logger.warn(datos);
    else logger.log(datos);
  });
  contexto.run(ctx, () => next());
}
