import { advertenciasPrograma, validarAtributos } from '../dominio/atributos.js';
import { DefinicionPrograma } from '../programas/programas.repository.js';
import { FilaExport, generarCsv } from './exportacion.js';
import { FilaVentaDto } from './ventas.dto.js';
import { ComponenteExistente, validarVentas } from './ventas.validacion.js';

const neu: DefinicionPrograma = {
  id: 'neu', nombre: 'Neumáticos', orden: 2, configurado: true, agrupador: 'categoria', desglose: 'subcategoria',
  atributos: { marca: 'Marca', tipo: 'Tipo', categoria: 'Categoría', aro: 'Aro' },
  definicionAtributos: [
    { clave: 'marca', etiqueta: 'Marca', tipo: 'texto', obligatorio: true, valores: null },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'texto', obligatorio: true, valores: ['Radial', 'Diagonal', 'Macizo'] },
    { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto', obligatorio: true, valores: ['Categoría A', 'Categoría B'] },
    { clave: 'aro', etiqueta: 'Aro', tipo: 'numero', obligatorio: true, valores: null },
  ],
};

const fila = (extra: Partial<FilaVentaDto> = {}): FilaVentaDto => ({
  programaId: 'neu', documento: 'DIN-1', fecha: '2025-03-10', sku: 'NEU-1', unidades: 10,
  atributos: { marca: 'Michelin', tipo: 'Radial', categoria: 'Categoría A', aro: 16 },
  ...extra,
});

const sinExistentes = new Map<string, ComponenteExistente[]>();

describe('validarAtributos', () => {
  it('convierte números con coma y valida valores permitidos', () => {
    const r = validarAtributos(neu.definicionAtributos, { aro: '22,5', tipo: 'Radial' }, false);
    expect(r.errores).toEqual([]);
    expect(r.valores).toEqual({ aro: 22.5, tipo: 'Radial' });
  });

  it('rechaza valores fuera de la lista, atributos desconocidos y números inválidos', () => {
    const r = validarAtributos(neu.definicionAtributos, { tipo: 'Tubular', color: 'negro', aro: 'x' }, false);
    expect(r.errores).toHaveLength(3);
  });

  it('exige los obligatorios solo para SKUs nuevos', () => {
    expect(validarAtributos(neu.definicionAtributos, { marca: 'X' }, true).errores).toHaveLength(3);
    expect(validarAtributos(neu.definicionAtributos, { marca: 'X' }, false).errores).toHaveLength(0);
  });
});

describe('advertenciasPrograma (DS 8/2019)', () => {
  it('avisa si la categoría no coincide con el aro', () => {
    expect(advertenciasPrograma('neu', { aro: 49, categoria: 'Categoría B' })).toHaveLength(1);
    expect(advertenciasPrograma('neu', { aro: 57, categoria: 'Categoría B' })).toHaveLength(0);
    expect(advertenciasPrograma('neu', { aro: 16, categoria: 'Categoría A' })).toHaveLength(0);
    expect(advertenciasPrograma('env', { aro: 49, categoria: 'Categoría B' })).toHaveLength(0);
  });
});

describe('validarVentas', () => {
  it('acepta un SKU nuevo completo y arma su plan', () => {
    const r = validarVentas(neu, [fila({ pesoKg: 8.5, descripcion: 'Auto 16' })], sinExistentes);
    expect(r.errores).toEqual([]);
    expect(r.skus).toEqual([
      { sku: 'NEU-1', nuevo: true, unComponente: true, nombre: 'Auto 16', pesoKg: 8.5,
        atributos: { marca: 'Michelin', tipo: 'Radial', categoria: 'Categoría A', aro: 16 } },
    ]);
  });

  it('un SKU nuevo sin atributos obligatorios es error; uno existente no', () => {
    const sinAtributos = fila({ atributos: null });
    expect(validarVentas(neu, [sinAtributos], sinExistentes).errores.length).toBeGreaterThan(0);
    const existentes = new Map([['NEU-1', [{ id: '1', nombre: 'NEU-1', atributos: { marca: 'X' }, pesoKg: 9 }]]]);
    expect(validarVentas(neu, [sinAtributos], existentes).errores).toEqual([]);
  });

  it('detecta registros repetidos por id de origen o por DIN+SKU+fecha+sucursal', () => {
    expect(validarVentas(neu, [fila({ idOrigen: '7' }), fila({ idOrigen: '7', documento: 'DIN-2' })], sinExistentes).errores[0].mensaje)
      .toContain('repetido');
    expect(validarVentas(neu, [fila(), fila()], sinExistentes).errores).toHaveLength(1);
    expect(validarVentas(neu, [fila({ sucursal: 'S1' }), fila({ sucursal: 'S2' })], sinExistentes).errores).toEqual([]);
  });

  it('rechaza fechas que no existen', () => {
    expect(validarVentas(neu, [fila({ fecha: '2025-02-30' })], sinExistentes).errores[0].mensaje).toContain('Fecha');
  });

  it('avisa (sin bloquear) cuando el peso de la planilla difiere del vigente y por la regla del aro', () => {
    const existentes = new Map([['NEU-1', [{ id: '1', nombre: 'NEU-1', atributos: {}, pesoKg: 9 }]]]);
    const r = validarVentas(neu, [fila({ pesoKg: 10, atributos: { ...fila().atributos!, aro: 63 } })], existentes);
    expect(r.errores).toEqual([]);
    expect(r.advertencias.map((a) => a.mensaje).join(' ')).toMatch(/distinto del vigente.*|DS 8/);
    expect(r.advertencias).toHaveLength(2);
  });

  it('en SKUs con varios componentes no toma atributos ni peso de la planilla', () => {
    const existentes = new Map([['NEU-1', [
      { id: '1', nombre: 'botella', atributos: { marca: 'A' }, pesoKg: 0.02 },
      { id: '2', nombre: 'tapa', atributos: { marca: 'B' }, pesoKg: 0.003 },
    ]]]);
    const r = validarVentas(neu, [fila({ pesoKg: 1 })], existentes);
    expect(r.skus[0]).toMatchObject({ unComponente: false, pesoKg: null, atributos: { marca: 'A' } });
    expect(r.advertencias).toHaveLength(2);
  });
});

describe('generarCsv', () => {
  it('usa los nombres de la especificación y escapa valores', () => {
    const f: FilaExport = {
      movimiento_id: 1, id_origen: '11', fecha: '2025-11-17', anio_comercial: 2025, documento: 'DIN-25-1', sku: 'NEU-1',
      componente: 'Yokohama 195/65 R15', atributos: JSON.stringify({ marca: 'Yoko, "Hama"', aro: 15 }),
      sucursal: null, peso_kg: 9.33, unidades: 673, kilos: 6279.09, toneladas: 6.27909,
    };
    const [enc, linea] = generarCsv(neu, [f]).replace('﻿', '').split('\r\n');
    expect(enc).toBe('ID_Registro,ID_Origen,Fecha_Introduccion,Año_Comercial,DIN,SKU,Componente,Marca,Tipo,Categoría,Aro,Sucursal,Peso_Unitario_KG,Unidades,Kilos_Introducidos,Toneladas_Introducidas');
    expect(linea).toBe('1,11,2025-11-17,2025,DIN-25-1,NEU-1,Yokohama 195/65 R15,"Yoko, ""Hama""",,,15,,9.33,673,6279.09,6.27909');
  });
});
