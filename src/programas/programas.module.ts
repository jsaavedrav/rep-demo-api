import { Module } from '@nestjs/common';
import { ProgramasController } from './programas.controller.js';
import { ProgramasRepository } from './programas.repository.js';

@Module({
  controllers: [ProgramasController],
  providers: [ProgramasRepository],
  exports: [ProgramasRepository],
})
export class ProgramasModule {}
