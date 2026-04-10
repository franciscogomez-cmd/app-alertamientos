import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Valores permitidos para nivel_severidad */
export enum NivelSeveridad {
  PREVENTIVA = 'preventiva',
  EMERGENCIA = 'emergencia',
  INFORMATIVA = 'informativa',
}

/** Valores permitidos para estatus_alerta */
export enum EstatusAlerta {
  BORRADOR = 'borrador',
  ACTIVA = 'activa',
  DESACTIVADA = 'desactivada',
  EXPIRADA = 'expirada',
  CANCELADA = 'cancelada',
}

/** Valores permitidos para nivel_cobertura */
export enum NivelCobertura {
  PAIS = 'pais',
  ESTADO = 'estado',
  MUNICIPIO = 'municipio',
  COLONIA = 'colonia',
  CODIGO_POSTAL = 'codigo_postal',
  ZONA_PERSONALIZADA = 'zona_personalizada',
}

/**
 * DTO para asociar zonas a una alerta (relación N:M).
 */
export class AlertaZonaDto {
  @IsInt({ message: 'zonaId debe ser un entero.' })
  zonaId!: number;
}

/**
 * DTO para crear una nueva alerta.
 */
export class CreateAlertaDto {
  @IsInt({ message: 'categoriaId debe ser un entero.' })
  categoriaId!: number;

  @IsString()
  @IsNotEmpty({ message: 'El título es requerido.' })
  @MaxLength(200, { message: 'El título no debe exceder 200 caracteres.' })
  titulo!: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es requerida.' })
  descripcion!: string;

  @IsEnum(NivelSeveridad, { message: 'nivelSeveridad debe ser: preventiva, emergencia o informativa.' })
  nivelSeveridad!: NivelSeveridad;

  @IsEnum(NivelCobertura, { message: 'nivelCobertura debe ser: pais, estado, municipio, colonia, codigo_postal, zona_personalizada.' })
  nivelCobertura!: NivelCobertura;

  @IsEnum(EstatusAlerta, { message: 'estatus inválido.' })
  @IsOptional()
  estatus?: EstatusAlerta;

  // ── Vigencia ──────────────────────────────────────────────────────────────

  @IsDateString({}, { message: 'fechaInicio debe ser una fecha ISO válida.' })
  @IsOptional()
  fechaInicio?: string;

  @IsDateString({}, { message: 'fechaFin debe ser una fecha ISO válida.' })
  @IsOptional()
  fechaFin?: string;

  // ── Cobertura geográfica ──────────────────────────────────────────────────

  @IsInt({ message: 'zonaId debe ser un entero.' })
  @IsOptional()
  zonaId?: number;

  @IsNumber({}, { message: 'centroLatitud debe ser un número.' })
  @IsOptional()
  centroLatitud?: number;

  @IsNumber({}, { message: 'centroLongitud debe ser un número.' })
  @IsOptional()
  centroLongitud?: number;

  @IsNumber({}, { message: 'radioKm debe ser un número.' })
  @IsOptional()
  radioKm?: number;

  @IsOptional()
  poligonoZona?: any;

  // ── Zonas múltiples (N:M) ─────────────────────────────────────────────────

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlertaZonaDto)
  @IsOptional()
  zonas?: AlertaZonaDto[];

  // ── Acciones sugeridas ────────────────────────────────────────────────────

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acciones?: string[];

  // ── Metadata ──────────────────────────────────────────────────────────────

  @IsString()
  @MaxLength(500)
  @IsOptional()
  imagenUrl?: string;

  @IsBoolean()
  @IsOptional()
  mapaVisible?: boolean;
}
