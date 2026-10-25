// Modelos que la API entrega al frontend. Copia de rep-demo-front/src/app/core/models.ts:
// si cambias uno, cambia el otro (o extráelos a un paquete compartido cuando crezcan).

export type Perfil = 'admin' | 'operador' | 'consulta';

export type Permiso =
  | 'sku.importar'
  | 'sku.pesos'
  | 'gestion.ingresar'
  | 'informes.ver'
  | 'informes.exportar'
  | 'usuarios.ver';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  perfil: Perfil;
  /** Productos prioritarios a los que tiene acceso. */
  programas: string[];
}

export interface AtributoDef {
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'numero';
  obligatorio: boolean;
  valores: string[] | null;
}

/** Producto prioritario REP (Envases y embalajes, Neumáticos, ...). */
export interface Programa {
  id: string;
  nombre: string;
  orden: number;
  /** false = aún no tiene atributos definidos: se muestra, pero no se puede usar. */
  configurado: boolean;
  /** El usuario actual tiene acceso a este programa. */
  acceso: boolean;
  /** clave -> etiqueta, en orden. */
  atributos: Record<string, string>;
  definicionAtributos: AtributoDef[];
  agrupador: string;
  desglose: string;
}

export type ValorAtributo = string | number;

export interface SkuComponente {
  id: string;
  programaId: string;
  sku: string;
  nombre: string;
  atributos: Record<string, ValorAtributo>;
  /** Peso vigente: se usa para autocompletar nuevas cargas. `null` = pendiente. */
  pesoKg: number | null;
}

export interface Movimiento {
  id: string;
  programaId: string;
  idOrigen: string | null;
  documento: string; // DIN
  fecha: string; // YYYY-MM-DD
  sucursal: string | null;
  proveedor: string | null;
  sku: string;
  unidades: number;
  /** Peso congelado por componente (id -> kg). `null` = pendiente, no suma masa. */
  pesos: Record<string, number | null>;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
}

export interface Aviso {
  fila: number;
  mensaje: string;
}

export interface ResultadoImportacionVentas extends ResultadoImportacion {
  skusNuevos: number;
  /** Componentes sin peso: sus registros quedaron pendientes y no suman masa. */
  pendientesPeso: { componenteId: string; sku: string; nombre: string }[];
  advertencias: Aviso[];
}

export type TipoMeta = 'recoleccion' | 'valorizacion';

export interface Gestion {
  id: string;
  programaId: string;
  anio: number;
  categoria: string;
  tipoMeta: TipoMeta;
  kilos: number;
  fuente: 'GRANSIC' | 'SISREP' | 'otro';
  fecha: string | null;
  documento: string | null;
  sku: string | null;
  observacion: string | null;
}

export interface Tarifa {
  id: string;
  programaId: string;
  categoria: string;
  fecha: string;
  precioKgClp: number;
  gestor: string | null;
  documento: string | null;
  observacion: string | null;
}

export interface MetaLegal {
  categoria: string;
  tipoMeta: TipoMeta;
  anioDesde: number;
  porcentaje: number;
}

export interface Parametro {
  clave: string;
  vigenteDesde: string;
  valor: number;
  descripcion: string | null;
}
