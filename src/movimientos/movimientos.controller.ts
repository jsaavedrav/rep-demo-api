import { Body, Controller, Get, Param, ParseArrayPipe, Post } from '@nestjs/common';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { NuevoMovimientoDto } from './movimientos.dto.js';
import { MovimientosRepository } from './movimientos.repository.js';
import { MovimientosService } from './movimientos.service.js';

@Controller()
export class MovimientosController {
  constructor(
    private readonly service: MovimientosService,
    private readonly movimientos: MovimientosRepository,
  ) {}

  @Get('programas/:programaId/movimientos')
  @RequierePermiso('informes.ver')
  listar(@Param('programaId') programaId: string) {
    return this.movimientos.listar(programaId);
  }

  @Post('movimientos/importar')
  @RequierePermiso('sku.importar')
  importar(
    @Body(new ParseArrayPipe({ items: NuevoMovimientoDto, whitelist: true, forbidNonWhitelisted: true })) items: NuevoMovimientoDto[],
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.service.importar(items, usuario);
  }
}
