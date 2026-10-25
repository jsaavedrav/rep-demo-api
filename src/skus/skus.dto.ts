import { IsNumber, IsObject, IsOptional, IsPositive, IsString, Length } from 'class-validator';

// Validación de forma (tipos y largos, según rep.sku_componente).
// Las reglas que dependen de datos (programa y atributos válidos) están en SkusService.

export class NuevoComponenteDto {
  @IsString() @Length(1, 20) programaId: string;
  @IsString() @Length(1, 50) sku: string;
  @IsString() @Length(1, 150) nombre: string;
  @IsObject() atributos: Record<string, string | number>;
  @IsOptional() @IsNumber() @IsPositive() pesoKg: number | null;
}

export class ActualizarPesoDto {
  @IsNumber() @IsPositive() pesoKg: number;
}
