import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard.js';
import { VerificadorToken } from './auth/verificador-token.js';
import { DatabaseModule } from './database/database.module.js';
import { GestionModule } from './gestion/gestion.module.js';
import { HealthController } from './health.controller.js';
import { MovimientosModule } from './movimientos/movimientos.module.js';
import { ProgramasModule } from './programas/programas.module.js';
import { SkusModule } from './skus/skus.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsuariosModule,
    ProgramasModule,
    SkusModule,
    MovimientosModule,
    GestionModule,
  ],
  controllers: [HealthController],
  // Todos los endpoints exigen sesión y permisos, salvo los marcados con @Publico().
  providers: [VerificadorToken, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
