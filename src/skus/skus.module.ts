import { Module } from '@nestjs/common';
import { ProgramasModule } from '../programas/programas.module.js';
import { SkusController } from './skus.controller.js';
import { SkusRepository } from './skus.repository.js';
import { SkusService } from './skus.service.js';

@Module({
  imports: [ProgramasModule],
  controllers: [SkusController],
  providers: [SkusService, SkusRepository],
})
export class SkusModule {}
