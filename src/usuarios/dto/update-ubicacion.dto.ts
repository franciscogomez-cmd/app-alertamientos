import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateUbicacionDto {
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  latitud: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  longitud: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  precisionMetros?: number;
}
