import { Injectable } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores.js';
import { ErrorFila, rechazarSiHayErrores, validarCantidad } from '../importacion.js';
import { ProgramasRepository } from '../programas/programas.repository.js';
import { NuevoMovimientoDto } from './movimientos.dto.js';
import { MovimientosRepository } from './movimientos.repository.js';

@Injectable()
export class MovimientosService {
  constructor(
    private readonly movimientos: MovimientosRepository,
    private readonly programas: ProgramasRepository,
  ) {}

  async importar(items: NuevoMovimientoDto[], usuario: UsuarioActual) {
    validarCantidad(items);
    const programaId = items[0].programaId;
    const errores: ErrorFila[] = [];

    if (!(await this.programas.obtener(programaId))) {
      errores.push({ fila: 1, mensaje: `Programa "${programaId}" no existe` });
    } else {
      const skus = await this.movimientos.skusExistentes(programaId);
      items.forEach((m, i) => {
        if (m.programaId !== programaId) errores.push({ fila: i + 1, mensaje: 'Todas las filas deben ser del mismo programa' });
        else if (!skus.has(m.sku)) errores.push({ fila: i + 1, mensaje: `SKU "${m.sku}" no existe en el catálogo` });
        else if (isNaN(Date.parse(m.fecha))) errores.push({ fila: i + 1, mensaje: `Fecha inválida: "${m.fecha}"` });
      });
    }
    rechazarSiHayErrores(errores);

    return this.movimientos.importar(programaId, items, usuario.id);
  }
}
