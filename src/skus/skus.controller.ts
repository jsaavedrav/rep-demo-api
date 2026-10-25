import { Body, Controller, Get, Param, ParseArrayPipe, ParseIntPipe, Patch, Post, type Type } from '@nestjs/common';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { ActualizarPesoDto, NuevoComponenteDto } from './skus.dto.js';
import { SkusService } from './skus.service.js';

const filas = (items: Type) => new ParseArrayPipe({ items, whitelist: true, forbidNonWhitelisted: true });

@Controller()
export class SkusController {
  constructor(private readonly service: SkusService) {}

  @Get('programas/:programaId/skus')
  @RequierePermiso('informes.ver')
  listar(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.listar(programaId, usuario);
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
