import { Module } from '@nestjs/common';
import { ProgramasModule } from '../programas/programas.module.js';
import { MovimientosController } from './movimientos.controller.js';
import { MovimientosRepository } from './movimientos.repository.js';
import { MovimientosService } from './movimientos.service.js';

@Module({
  imports: [ProgramasModule],
  controllers: [MovimientosController],
  providers: [MovimientosService, MovimientosRepository],
})
export class MovimientosModule {}
