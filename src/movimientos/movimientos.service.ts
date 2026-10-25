import { BadRequestException, Injectable } from '@nestjs/common';
import { exigirAcceso } from '../auth/acceso.js';
import { UsuarioActual } from '../auth/decoradores.js';
import { ResultadoImportacionVentas } from '../dominio/models.js';
import { rechazarSiHayErrores, validarCantidad } from '../importacion.js';
import { ProgramasRepository } from '../programas/programas.repository.js';
import { MovimientosRepository } from './movimientos.repository.js';
import { FilaVentaDto } from './ventas.dto.js';
import { generarCsv } from './exportacion.js';
import { validarVentas } from './ventas.validacion.js';

@Injectable()
export class MovimientosService {
  constructor(
    private readonly movimientos: MovimientosRepository,
    private readonly programas: ProgramasRepository,
  ) {}

  async listar(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    return this.movimientos.listar(programaId);
  }

  /** CSV con los datos de introducción al mercado, para importar en Power BI. */
  async exportarCsv(programaId: string, usuario: UsuarioActual) {
    exigirAcceso(usuario, programaId);
    const programa = await this.programas.obtener(programaId);
    if (!programa) throw new BadRequestException(`Programa "${programaId}" no existe`);
    return generarCsv(programa, await this.movimientos.exportar(programaId));
  }

  /**
   * Importación unificada (planilla de ventas / aduana). Todo o nada: si una fila tiene errores
   * no se guarda ninguna. Las advertencias no bloquean y se devuelven en la respuesta.
   */
  async importarVentas(filas: FilaVentaDto[], usuario: UsuarioActual): Promise<ResultadoImportacionVentas> {
    validarCantidad(filas);
    const programaId = filas[0].programaId;
    exigirAcceso(usuario, programaId);

    const programa = await this.programas.obtener(programaId);
    if (!programa) throw new BadRequestException(`Programa "${programaId}" no existe`);
    if (!programa.configurado) throw new BadRequestException(`${programa.nombre} aún no está configurado`);

    const existentes = await this.movimientos.componentesDe(programaId, filas.map((f) => f.sku));
    const v = validarVentas(programa, filas, existentes);
    rechazarSiHayErrores(v.errores);

    const r = await this.movimientos.importarVentas(programaId, filas, v.skus, usuario.id);
    return { ...r, advertencias: v.advertencias };
  }
}
