// Modelos que la API entrega al frontend. Copia de rep-demo-front/src/app/core/models.ts:
// si cambias uno, cambia el otro (o extráelos a un paquete compartido cuando crezcan).

export type Perfil = 'admin' | 'operador' | 'consulta';

export type Permiso = 'sku.importar' | 'sku.pesos' | 'informes.ver' | 'informes.exportar' | 'usuarios.ver';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  perfil: Perfil;
}

export interface Programa {
  id: string;
  nombre: string;
  atributos: Record<string, string>;
  agrupador: string;
  desglose: string;
}

export interface SkuComponente {
  id: string;
  programaId: string;
  sku: string;
  nombre: string;
  atributos: Record<string, string>;
  pesoKg: number | null;
}

export interface Movimiento {
  id: string;
  programaId: string;
  documento: string;
  fecha: string; // YYYY-MM-DD
  proveedor: string;
  sku: string;
  unidades: number;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
}
