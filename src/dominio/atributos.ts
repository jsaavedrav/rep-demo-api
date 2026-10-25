import { AtributoDef, ValorAtributo } from './models.js';

// Validación de atributos de clasificación según la definición de cada programa
// (rep.programa_atributo). Lógica pura, sin base de datos: se prueba en atributos.spec.ts.

export interface ResultadoAtributos {
  /** Atributos con los tipos corregidos (ej: "22,5" -> 22.5). Solo incluye los informados. */
  valores: Record<string, ValorAtributo>;
  errores: string[];
}

/**
 * @param exigirObligatorios true para SKUs nuevos: deben traer todos los obligatorios.
 *   Para SKUs existentes los atributos son opcionales (se conservan los que ya tenía).
 */
export function validarAtributos(
  defs: AtributoDef[],
  atributos: Record<string, unknown> | undefined,
  exigirObligatorios: boolean,
): ResultadoAtributos {
  const valores: Record<string, ValorAtributo> = {};
  const errores: string[] = [];
  const porClave = new Map(defs.map((d) => [d.clave, d]));

  for (const [clave, bruto] of Object.entries(atributos ?? {})) {
    const def = porClave.get(clave);
    if (!def) {
      errores.push(`Atributo "${clave}" no existe en este producto`);
      continue;
    }
    if (bruto === null || bruto === undefined || String(bruto).trim() === '') continue;

    if (def.tipo === 'numero') {
      const n = typeof bruto === 'number' ? bruto : Number(String(bruto).trim().replace(',', '.'));
      if (!Number.isFinite(n)) errores.push(`${def.etiqueta} debe ser un número: "${bruto}"`);
      else valores[clave] = n;
    } else {
      const texto = String(bruto).trim();
      if (texto.length > 100) errores.push(`${def.etiqueta} supera 100 caracteres`);
      else if (def.valores && !def.valores.includes(texto)) {
        errores.push(`${def.etiqueta} "${texto}" no es válido (valores: ${def.valores.join(', ')})`);
      } else valores[clave] = texto;
    }
  }

  if (exigirObligatorios) {
    for (const d of defs) {
      if (d.obligatorio && !(d.clave in valores) && !errores.some((e) => e.startsWith(d.etiqueta))) {
        errores.push(`${d.etiqueta} es obligatorio para un SKU nuevo`);
      }
    }
  }
  return { valores, errores };
}

/**
 * Reglas propias de cada producto prioritario que no bloquean la carga, pero conviene revisar.
 * Neumáticos (DS 8/2019): Categoría A = aro menor a 57"; Categoría B = aro de 57" o más.
 */
export function advertenciasPrograma(programaId: string, atributos: Record<string, ValorAtributo>): string[] {
  if (programaId === 'neu' && typeof atributos['aro'] === 'number' && atributos['categoria']) {
    const esperada = atributos['aro'] >= 57 ? 'Categoría B' : 'Categoría A';
    if (atributos['categoria'] !== esperada) {
      return [`Aro ${atributos['aro']}" corresponde a ${esperada} según el DS 8/2019, pero viene como ${atributos['categoria']}`];
    }
  }
  return [];
}
