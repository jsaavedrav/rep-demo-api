import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Kilos gestionados informados por GRANSIC / SISREP (ingreso manual). */
export class NuevaGestionDto {
  @IsString() @Length(1, 20) programaId: string;
  @IsInt() @Min(2020) @Max(2100) anio: number;
  @IsString() @Length(1, 50) categoria: string;
  @IsIn(['recoleccion', 'valorizacion']) tipoMeta: 'recoleccion' | 'valorizacion';
  @IsNumber() @IsPositive() kilos: number;
  @IsIn(['GRANSIC', 'SISREP', 'otro']) fuente: 'GRANSIC' | 'SISREP' | 'otro';
  @IsOptional() @Matches(FECHA, { message: 'fecha debe tener formato AAAA-MM-DD' }) fecha?: string | null;
  @IsOptional() @IsString() @MaxLength(100) documento?: string | null;
  @IsOptional() @IsString() @MaxLength(50) sku?: string | null;
  @IsOptional() @IsString() @MaxLength(500) observacion?: string | null;
}

/** Precio por kilo del servicio de gestión en pesos chilenos, según la compra o contrato. */
export class NuevaTarifaDto {
  @IsString() @Length(1, 20) programaId: string;
  @IsString() @Length(1, 50) categoria: string;
  @Matches(FECHA, { message: 'fecha debe tener formato AAAA-MM-DD' }) fecha: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() precioKgClp: number;
  @IsOptional() @IsString() @MaxLength(150) gestor?: string | null;
  @IsOptional() @IsString() @MaxLength(100) documento?: string | null;
  @IsOptional() @IsString() @MaxLength(500) observacion?: string | null;
}
