import { Module } from '@nestjs/common';
import { ProgramasModule } from '../programas/programas.module.js';
import { GestionController } from './gestion.controller.js';
import { GestionRepository } from './gestion.repository.js';
import { GestionService } from './gestion.service.js';

@Module({
  imports: [ProgramasModule],
  controllers: [GestionController],
  providers: [GestionService, GestionRepository],
})
export class GestionModule {}
