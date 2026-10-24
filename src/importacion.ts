import { BadRequestException } from '@nestjs/common';

// Utilidades comunes a las importaciones de catálogo y movimientos.

/** Máximo de filas por importación (protege memoria y el tiempo de la transacción). */
export const MAX_FILAS = 20_000;

export interface ErrorFila {
  fila: number; // 1 = primer elemento enviado
  mensaje: string;
}

export function validarCantidad(items: unknown[]) {
  if (!items.length) throw new BadRequestException('No hay filas para importar');
  if (items.length > MAX_FILAS) throw new BadRequestException(`Máximo ${MAX_FILAS} filas por importación`);
}

/** Rechaza la importación completa si hay errores: o entra todo, o nada. */
export function rechazarSiHayErrores(errores: ErrorFila[]) {
  if (errores.length) {
    throw new BadRequestException({ message: `${errores.length} fila(s) con errores`, errores: errores.slice(0, 50) });
  }
}
