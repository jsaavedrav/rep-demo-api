import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Response } from 'express';
import { contextoActual } from './contexto.js';

/**
 * Errores no controlados (5xx): se registran con su stack y en Application Insights (tabla
 * exceptions), y al usuario se le responde un mensaje genérico con el código para rastrearlo,
 * sin exponer detalles internos (nombres de tablas, mensajes de SQL...).
 * Los 4xx (validaciones, permisos) siguen la respuesta normal de Nest.
 */
@Catch()
export class FiltroErrores extends BaseExceptionFilter {
  private readonly logger = new Logger('Errores');

  override catch(error: unknown, host: ArgumentsHost) {
    const estado = error instanceof HttpException ? error.getStatus() : 500;
    if (estado < 500 || host.getType() !== 'http') return super.catch(error, host);

    const requestId = contextoActual()?.requestId;
    const e = error instanceof Error ? error : new Error(String(error));
    this.logger.error({ message: e.message, error: e.name, stack: e.stack, requestId });
    const span = trace.getActiveSpan();
    span?.recordException(e);
    span?.setStatus({ code: SpanStatusCode.ERROR, message: e.message });

    if (error instanceof HttpException) return super.catch(error, host);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(500)
      .json({ statusCode: 500, message: `Error interno del servidor. Código de seguimiento: ${requestId ?? 's/c'}`, requestId });
  }
}
