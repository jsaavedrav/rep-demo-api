import { AtributoDef, ValorAtributo } from './models.js';

// Validación de atributos de clasificación según la definición de cada programa
// (rep.programa_atributo). Lógica pura, sin base de datos: se prueba en atributos.spec.ts.

/** Para comparar valores sin distinguir mayúsculas ni tildes ("No Domiciliario" = "No domiciliario"). */
const comparable = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

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
      else if (def.valores) {
        // Se guarda el valor tal como está definido, aunque la planilla use otras mayúsculas o tildes.
        const permitido = def.valores.find((v) => comparable(v) === comparable(texto));
        if (permitido) valores[clave] = permitido;
        else errores.push(`${def.etiqueta} "${texto}" no es válido (valores: ${def.valores.join(', ')})`);
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

/** Envases (DS 12): subcategorías que corresponden a cada clasificación, según la especificación. */
const SUBCATEGORIAS_ENVASES: Record<string, string[]> = {
  Domiciliario: ['Cartón para líquidos', 'Metal', 'Papel y cartón', 'Plástico', 'Vidrio'],
  'No domiciliario': ['Metal', 'Papel y cartón', 'Plástico', 'Madera'],
};

/** Pilas y AEE: tipos de pila integrada; el resto de las categorías son de equipos. */
const TIPOS_PILA = ['Batería Recargable (Litio, Níquel)', 'Pila Botón', 'Pila Estándar (AA, AAA, C, D)'];

/**
 * Reglas propias de cada producto prioritario que no bloquean la carga, pero conviene revisar.
 * Neumáticos (DS 8/2019): Categoría A = aro menor a 57"; Categoría B = aro de 57" o más.
 * Envases: la subcategoría debe existir para la clasificación (ej: Vidrio solo es Domiciliario).
 * Pilas y AEE: la línea Pilas usa un tipo de pila como categoría; la línea Equipos, una categoría de aparato.
 */
export function advertenciasPrograma(programaId: string, atributos: Record<string, ValorAtributo>): string[] {
  const clase = String(atributos['clase'] ?? '');
  const material = String(atributos['material'] ?? '');
  if (programaId === 'env' && SUBCATEGORIAS_ENVASES[clase] && material && !SUBCATEGORIAS_ENVASES[clase].includes(material)) {
    return [`Subcategoría ${material} no corresponde a envases ${clase} (permitidas: ${SUBCATEGORIAS_ENVASES[clase].join(', ')})`];
  }
  const linea = atributos['linea'];
  const categoria = String(atributos['categoria'] ?? '');
  if (programaId === 'aee' && linea && categoria && (linea === 'Pilas') !== TIPOS_PILA.includes(categoria)) {
    return [linea === 'Pilas'
      ? `Una pila debe tener como categoría un tipo de pila (${TIPOS_PILA.join(', ')}), no "${categoria}"`
      : `"${categoria}" es un tipo de pila: corresponde a la línea Pilas, no ${linea}`];
  }
  if (programaId === 'neu' && typeof atributos['aro'] === 'number' && atributos['categoria']) {
    const esperada = atributos['aro'] >= 57 ? 'Categoría B' : 'Categoría A';
    if (atributos['categoria'] !== esperada) {
      return [`Aro ${atributos['aro']}" corresponde a ${esperada} según el DS 8/2019, pero viene como ${atributos['categoria']}`];
    }
  }
  return [];
}
