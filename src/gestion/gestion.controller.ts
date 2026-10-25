import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { NuevaGestionDto, NuevaTarifaDto } from './gestion.dto.js';
import { GestionService } from './gestion.service.js';

@Controller()
export class GestionController {
  constructor(private readonly service: GestionService) {}

  // --- Kilos gestionados (GRANSIC / SISREP) ---

  @Get('programas/:programaId/gestion')
  @RequierePermiso('informes.ver')
  listarGestion(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.listarGestion(programaId, usuario);
  }

  @Post('gestion')
  @RequierePermiso('gestion.ingresar')
  crearGestion(@Body() dto: NuevaGestionDto, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.crearGestion(dto, usuario);
  }

  @Delete('gestion/:id')
  @HttpCode(204)
  @RequierePermiso('gestion.ingresar')
  eliminarGestion(@Param('id', ParseIntPipe) id: number, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.eliminar('gestion', id, usuario);
  }

  // --- Tarifas de gestión (CLP por kilo) ---

  @Get('programas/:programaId/tarifas')
  @RequierePermiso('informes.ver')
  listarTarifas(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.listarTarifas(programaId, usuario);
  }

  @Post('tarifas')
  @RequierePermiso('gestion.ingresar')
  crearTarifa(@Body() dto: NuevaTarifaDto, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.crearTarifa(dto, usuario);
  }

  @Delete('tarifas/:id')
  @HttpCode(204)
  @RequierePermiso('gestion.ingresar')
  eliminarTarifa(@Param('id', ParseIntPipe) id: number, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.eliminar('tarifa_gestion', id, usuario);
  }

  // --- Parámetros legales (solo lectura) ---

  @Get('programas/:programaId/metas')
  @RequierePermiso('informes.ver')
  metas(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.metas(programaId, usuario);
  }

  @Get('programas/:programaId/parametros')
  @RequierePermiso('informes.ver')
  parametros(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.parametros(programaId, usuario);
  }
}
