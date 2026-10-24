import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosRepository } from './usuarios.repository.js';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosRepository],
  exports: [UsuariosRepository],
})
export class UsuariosModule {}
