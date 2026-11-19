import { Logger } from '@nestjs/common';
import { logs } from '@opentelemetry/api-logs';

type Valor = string | number | boolean;

const logger = new Logger('Evento');

/**
 * Evento de negocio (importación, exportación, acceso denegado...). Queda como línea de log y,
 * con la telemetría activa, en la tabla customEvents de Application Insights.
 */
export function registrarEvento(nombre: string, datos: Record<string, Valor | undefined> = {}) {
  const atributos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)) as Record<string, Valor>;
  logger.log({ message: nombre, evento: nombre, ...atributos });
  // El atributo microsoft.custom_event.name hace que Azure Monitor lo guarde como customEvent.
  logs.getLogger('rep-api').emit({ body: nombre, attributes: { 'microsoft.custom_event.name': nombre, ...atributos } });
}

/** Mide la duración de una operación en milisegundos. */
export const cronometro = () => {
  const inicio = performance.now();
  return () => Math.round(performance.now() - inicio);
};
