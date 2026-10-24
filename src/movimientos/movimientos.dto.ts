import { IsInt, IsPositive, IsString, Length, Matches, MaxLength } from 'class-validator';

export class NuevoMovimientoDto {
  @IsString() @Length(1, 20) programaId: string;
  @IsString() @Length(1, 50) documento: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato AAAA-MM-DD' }) fecha: string;
  @IsString() @MaxLength(150) proveedor: string;
  @IsString() @Length(1, 50) sku: string;
  @IsInt() @IsPositive() unidades: number;
}
