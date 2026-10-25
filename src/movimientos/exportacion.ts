import { DefinicionPrograma } from '../programas/programas.repository.js';

// Export de los datos de introducción al mercado para Power BI (u otra herramienta).
// Columnas con los nombres de la especificación (tabla Datos_REP); los atributos usan su etiqueta
// (en neumáticos: Marca, Tipo, Categoría, Subcategoría, Aro, Dimensión).
// Formato CSV estándar: separador coma, decimales con punto, UTF-8 con BOM.

export interface FilaExport {
  movimiento_id: number;
  id_origen: string | null;
  fecha: string;
  anio_comercial: number;
  documento: string;
  sku: string;
  componente: string;
  atributos: string; // JSON
  sucursal: string | null;
  peso_kg: number | null;
  unidades: number;
  kilos: number | null;
  toneladas: number | null;
}

const celda = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function generarCsv(programa: DefinicionPrograma, filas: FilaExport[]): string {
  const defs = programa.definicionAtributos;
  const encabezado = [
    'ID_Registro', 'ID_Origen', 'Fecha_Introduccion', 'Año_Comercial', 'DIN', 'SKU', 'Componente',
    ...defs.map((d) => d.etiqueta),
    'Sucursal', 'Peso_Unitario_KG', 'Unidades', 'Kilos_Introducidos', 'Toneladas_Introducidas',
  ];
  const lineas = filas.map((f) => {
    const a = JSON.parse(f.atributos) as Record<string, unknown>;
    return [
      f.movimiento_id, f.id_origen, f.fecha, f.anio_comercial, f.documento, f.sku, f.componente,
      ...defs.map((d) => a[d.clave]),
      f.sucursal, f.peso_kg, f.unidades, f.kilos, f.toneladas,
    ].map(celda).join(',');
  });
  return '﻿' + [encabezado.map(celda).join(','), ...lineas].join('\r\n') + '\r\n';
}
