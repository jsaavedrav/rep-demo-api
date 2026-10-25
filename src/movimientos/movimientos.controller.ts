import { Body, Controller, Get, Header, Param, ParseArrayPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequierePermiso, UsuarioAutenticado, type UsuarioActual } from '../auth/decoradores.js';
import { MovimientosService } from './movimientos.service.js';
import { FilaVentaDto } from './ventas.dto.js';

@Controller()
export class MovimientosController {
  constructor(private readonly service: MovimientosService) {}

  @Get('programas/:programaId/movimientos')
  @RequierePermiso('informes.ver')
  listar(@Param('programaId') programaId: string, @UsuarioAutenticado() usuario: UsuarioActual) {
    return this.service.listar(programaId, usuario);
  }

  /** Descarga para Power BI: Obtener datos → Texto/CSV (origen de archivo UTF-8, delimitador coma). */
  @Get('programas/:programaId/export/datos.csv')
  @RequierePermiso('informes.exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportar(
    @Param('programaId') programaId: string,
    @UsuarioAutenticado() usuario: UsuarioActual,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Content-Disposition', `attachment; filename="datos-rep-${programaId}.csv"`);
    return this.service.exportarCsv(programaId, usuario);
  }

  @Post('ventas/importar')
  @RequierePermiso('sku.importar')
  importarVentas(
    @Body(new ParseArrayPipe({ items: FilaVentaDto, whitelist: true, forbidNonWhitelisted: true })) filas: FilaVentaDto[],
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.service.importarVentas(filas, usuario);
  }
}
