import { Body, Controller, Get, Param, ParseArrayPipe, ParseIntPipe, Patch, Post, type Type } from '@nestjs/common';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { ActualizarPesoDto, NuevoComponenteDto } from './skus.dto.js';
import { SkusRepository } from './skus.repository.js';
import { SkusService } from './skus.service.js';

const filas = (items: Type) => new ParseArrayPipe({ items, whitelist: true, forbidNonWhitelisted: true });

@Controller()
export class SkusController {
  constructor(
    private readonly service: SkusService,
    private readonly skus: SkusRepository,
  ) {}

  @Get('programas/:programaId/skus')
  @RequierePermiso('informes.ver')
  listar(@Param('programaId') programaId: string) {
    return this.skus.listar(programaId);
  }

  @Post('skus/importar')
  @RequierePermiso('sku.importar')
  importar(@Body(filas(NuevoComponenteDto)) items: NuevoComponenteDto[], @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.importar(items, usuario);
  }

  @Patch('skus/:id')
  @RequierePermiso('sku.pesos')
  actualizarPeso(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPesoDto, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.actualizarPeso(id, dto.pesoKg, usuario);
  }
}
