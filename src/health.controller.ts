import { Controller, Get } from '@nestjs/common';
import { Publico } from './auth/decoradores.js';

@Controller('health')
export class HealthController {
  /**
   * Sonda de vida para Container Apps. No consulta la base a propósito: si lo hiciera,
   * la base serverless nunca entraría en pausa y se cobraría todo el día.
   */
  @Get()
  @Publico()
  estado() {
    return { estado: 'ok' };
  }
}
