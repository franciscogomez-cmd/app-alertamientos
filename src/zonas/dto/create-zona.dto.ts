import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum TipoZona {
  PAIS = 'pais',
  ESTADO = 'estado',
  MUNICIPIO = 'municipio',
  COLONIA = 'colonia',
  CODIGO_POSTAL = 'codigo_postal',
  POLIGONO_CUSTOM = 'poligono_custom',
}

export class CreateZonaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsEnum(TipoZona, {
    message: `tipo debe ser uno de: ${Object.values(TipoZona).join(', ')}`,
  })
  tipo: TipoZona;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  clavePais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  claveEstado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  claveMunicipio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoPostal?: string;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  centroLatitud?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  centroLongitud?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  radioKm?: number;

  /** GeoJSON del polígono */
  @IsOptional()
  poligono?: any;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
