// Primero: la telemetría debe cargarse antes que express y mssql para instrumentarlos.
import './observabilidad/telemetria.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { FiltroErrores } from './observabilidad/errores.filter.js';
import { LoggerJson } from './observabilidad/logger-json.js';
import { solicitudes } from './observabilidad/solicitudes.middleware.js';

async function bootstrap() {
  // En Azure, logs JSON (consultables por campo en Log Analytics); en local, el formato legible de Nest.
  const json = process.env.NODE_ENV === 'production' || process.env.LOG_JSON === '1';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, json ? { logger: new LoggerJson() } : {});
  app.use(solicitudes);
  app.useGlobalFilters(new FiltroErrores(app.get(HttpAdapterHost).httpAdapter));

  app.setGlobalPrefix('api');
  // Las importaciones pueden traer miles de filas.
  app.useBodyParser('json', { limit: '10mb' });
  // El front (Static Web App) está en otro dominio: solo esos orígenes pueden llamar a la API.
  const origenes = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origenes,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    // traceparent: el front podrá enviar su traza para unirla con la de la API.
    allowedHeaders: ['Authorization', 'Content-Type', 'traceparent'],
    exposedHeaders: ['Content-Disposition', 'x-request-id'],
    maxAge: 86400,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
