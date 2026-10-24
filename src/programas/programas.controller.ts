import { Controller, Get } from '@nestjs/common';
import { ProgramasRepository } from './programas.repository.js';

@Controller('programas')
export class ProgramasController {
  constructor(private readonly programas: ProgramasRepository) {}

  @Get()
  listar() {
    return this.programas.listar();
  }
}
