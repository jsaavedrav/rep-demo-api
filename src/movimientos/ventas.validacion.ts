import { advertenciasPrograma, validarAtributos } from '../dominio/atributos.js';
import { Aviso, ValorAtributo } from '../dominio/models.js';
import { DefinicionPrograma } from '../programas/programas.repository.js';
import { FilaVentaDto } from './ventas.dto.js';

// Validación de la importación de ventas. Lógica pura: se prueba en ventas.validacion.spec.ts.

export interface ComponenteExistente {
  id: string;
  nombre: string;
  atributos: Record<string, ValorAtributo>;
  pesoKg: number | null;
}

/** Qué hacer con cada SKU de la planilla (se resuelve con la última fila de ese SKU). */
export interface PlanSku {
  sku: string;
  nuevo: boolean;
  /** SKU de un solo componente (neumáticos): sus atributos y peso se actualizan desde la planilla. */
  unComponente: boolean;
  nombre: string;
  atributos: Record<string, ValorAtributo>;
  pesoKg: number | null;
}

export interface ResultadoValidacion {
  errores: Aviso[];
  advertencias: Aviso[];
  skus: PlanSku[];
}

const fechaValida = (f: string) => {
  const d = new Date(`${f}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
};

/** Mismo criterio que los índices únicos de rep.movimiento. */
export const claveRegistro = (f: FilaVentaDto) =>
  f.idOrigen ? `origen:${f.idOrigen}` : `natural:${f.documento}|${f.sku}|${f.fecha}|${f.sucursal ?? ''}`;

export function validarVentas(
  programa: DefinicionPrograma,
  filas: FilaVentaDto[],
  existentes: Map<string, ComponenteExistente[]>,
): ResultadoValidacion {
  const errores: Aviso[] = [];
  const advertencias: Aviso[] = [];
  const vistos = new Map<string, number>();
  const planes = new Map<string, PlanSku>();

  filas.forEach((f, i) => {
    const fila = i + 1;
    const error = (mensaje: string) => errores.push({ fila, mensaje });
    const aviso = (mensaje: string) => advertencias.push({ fila, mensaje });

    if (f.programaId !== programa.id) return error('Todas las filas deben ser del mismo producto prioritario');
    if (!fechaValida(f.fecha)) error(`Fecha inválida: "${f.fecha}"`);

    const clave = claveRegistro(f);
    if (vistos.has(clave)) error(`Registro repetido en la planilla (igual a la fila ${vistos.get(clave)})`);
    else vistos.set(clave, fila);

    const componentes = existentes.get(f.sku) ?? [];
    const nuevo = componentes.length === 0;
    const unComponente = componentes.length <= 1;
    const r = validarAtributos(programa.definicionAtributos, f.atributos ?? undefined, nuevo);
    r.errores.forEach(error);

    const anterior = planes.get(f.sku);
    const base = anterior?.atributos ?? componentes[0]?.atributos ?? {};
    const atributos = unComponente ? { ...base, ...r.valores } : base;
    advertenciasPrograma(programa.id, atributos).forEach(aviso);

    if (!unComponente) {
      if (Object.keys(r.valores).length) aviso(`El SKU ${f.sku} tiene varios componentes: sus atributos no se actualizan desde esta planilla`);
      if (f.pesoKg) aviso(`El SKU ${f.sku} tiene varios componentes: el peso se ingresa por componente en "Ingresar pesos"`);
    } else if (f.pesoKg && componentes[0]?.pesoKg && f.pesoKg !== componentes[0].pesoKg) {
      aviso(
        `Peso de la planilla (${f.pesoKg} kg) distinto del vigente del SKU (${componentes[0].pesoKg} kg): ` +
          'se usa el de la planilla para este registro; el vigente no cambia',
      );
    }

    planes.set(f.sku, {
      sku: f.sku,
      nuevo,
      unComponente,
      nombre: f.descripcion?.trim() || anterior?.nombre || componentes[0]?.nombre || f.sku,
      atributos,
      pesoKg: (unComponente && f.pesoKg) || anterior?.pesoKg || null,
    });
    return;
  });

  return { errores, advertencias, skus: [...planes.values()] };
}
