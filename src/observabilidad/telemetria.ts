import { useAzureMonitor } from '@azure/monitor-opentelemetry';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { HttpInstrumentationConfig } from '@opentelemetry/instrumentation-http';
import { TediousInstrumentation } from '@opentelemetry/instrumentation-tedious';

/**
 * Envía trazas (solicitudes HTTP, consultas SQL, excepciones y eventos de negocio) a Application
 * Insights. Se importa primero en main.ts: tiene que cargarse antes que express y mssql para poder
 * instrumentarlos. Sin APPLICATIONINSIGHTS_CONNECTION_STRING (desarrollo local) no hace nada.
 */
try {
  process.loadEnvFile(); // en local la variable puede venir del .env; en Azure llega como variable de entorno
} catch {
  // sin .env
}

export const telemetriaActiva = Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);

if (telemetriaActiva) {
  useAzureMonitor({
    // Trazas de solicitudes, dependencias y excepciones. Los logs de consola ya los guarda
    // Container Apps en Log Analytics; no se duplican aquí.
    instrumentationOptions: {
      console: { enabled: false },
      bunyan: { enabled: false },
      winston: { enabled: false },
      // Las llamadas internas del SDK de identidad (token de Managed Identity) solo ensucian las trazas.
      azureSdk: { enabled: false },
      // El tipo publicado es el genérico, pero el paquete pasa estas opciones a HttpInstrumentation.
      http: {
        enabled: true,
        // Las sondas de Container Apps llaman al health check cada pocos segundos.
        ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/api/health'),
        // Servicio de metadatos/identidad de Azure (tokens de Managed Identity).
        ignoreOutgoingRequestHook: (opts) => opts.hostname === '169.254.169.254' || opts.host === '169.254.169.254',
      } as HttpInstrumentationConfig,
    },
    // Muestreo: hasta 5 trazas por segundo (de sobra para el volumen del MVP).
    tracesPerSecond: 5,
    enableLiveMetrics: true,
  });
  // El paquete de Azure no instrumenta SQL Server (mssql usa tedious por debajo).
  registerInstrumentations({ instrumentations: [new TediousInstrumentation()] });
}
