import { IsInt, IsNumber, IsObject, IsOptional, IsPositive, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * Una fila de la planilla de ventas / aduana (importación unificada): crea o actualiza el SKU
 * y registra las unidades introducidas al mercado.
 */
export class FilaVentaDto {
  @IsString() @Length(1, 20) programaId: string;
  /** ID_Registro de la planilla o línea de SAP. Si viene, re-importar actualiza en vez de duplicar. */
  @IsOptional() @IsString() @Length(1, 50) idOrigen?: string | null;
  /** DIN. */
  @IsString() @Length(1, 50) documento: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato AAAA-MM-DD' }) fecha: string;
  @IsOptional() @IsString() @Length(1, 30) sucursal?: string | null;
  @IsOptional() @IsString() @MaxLength(150) proveedor?: string | null;
  @IsString() @Length(1, 50) sku: string;
  /** Nombre del producto; si no viene se usa el SKU. */
  @IsOptional() @IsString() @Length(1, 150) descripcion?: string | null;
  /** Obligatorios para SKUs nuevos; opcionales si el SKU ya existe. */
  @IsOptional() @IsObject() atributos?: Record<string, string | number> | null;
  @IsInt() @IsPositive() unidades: number;
  /** Si no viene, se usa el peso vigente del SKU; si tampoco hay, el registro queda pendiente. */
  @IsOptional() @IsNumber() @IsPositive() pesoKg?: number | null;
}
