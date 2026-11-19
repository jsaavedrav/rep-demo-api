import { LoggerService } from '@nestjs/common';
import { contextoActual } from './contexto.js';

type Nivel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Logger de producción: una línea JSON por mensaje, con el requestId y el usuario de la solicitud
 * en curso. Container Apps la guarda en Log Analytics (tabla ContainerAppConsoleLogs_CL), donde se
 * consulta por campo. Si el mensaje es un objeto, sus campos se agregan a la línea.
 */
export class LoggerJson implements LoggerService {
  log(mensaje: unknown, ...params: unknown[]) {
    this.escribir('info', mensaje, params);
  }
  error(mensaje: unknown, ...params: unknown[]) {
    this.escribir('error', mensaje, params);
  }
  warn(mensaje: unknown, ...params: unknown[]) {
    this.escribir('warn', mensaje, params);
  }
  debug(mensaje: unknown, ...params: unknown[]) {
    this.escribir('debug', mensaje, params);
  }
  verbose(mensaje: unknown, ...params: unknown[]) {
    this.escribir('verbose', mensaje, params);
  }
  fatal(mensaje: unknown, ...params: unknown[]) {
    this.escribir('fatal', mensaje, params);
  }

  private escribir(nivel: Nivel, mensaje: unknown, params: unknown[]) {
    // Nest pasa el contexto (nombre de la clase) al final y, en error(), el stack antes.
    const resto = [...params];
    const contexto = resto.length && typeof resto.at(-1) === 'string' ? (resto.pop() as string) : undefined;
    const stack = typeof resto[0] === 'string' ? resto[0] : undefined;
    const solicitud = contextoActual();

    const linea: Record<string, unknown> = { time: new Date().toISOString(), level: nivel, context: contexto };
    if (mensaje instanceof Error) Object.assign(linea, { message: mensaje.message, stack: mensaje.stack });
    else if (mensaje && typeof mensaje === 'object') Object.assign(linea, mensaje);
    else linea['message'] = String(mensaje);
    if (stack) linea['stack'] = stack;
    if (solicitud) Object.assign(linea, { requestId: solicitud.requestId, usuarioId: solicitud.usuarioId });

    const texto = JSON.stringify(linea) + '\n';
    (nivel === 'error' || nivel === 'fatal' ? process.stderr : process.stdout).write(texto);
  }
}
