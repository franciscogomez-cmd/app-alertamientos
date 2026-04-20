import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export enum Plataforma {
  ANDROID = 'android',
  IOS = 'ios',
  HUAWEI = 'huawei',
}

export enum SeveridadMinima {
  PREVENTIVA = 'preventiva',
  EMERGENCIA = 'emergencia',
  INFORMATIVA = 'informativa',
}

export class CreateUsuarioDto {
  // ─── Identificadores del dispositivo ───────────────────────────────────────

  @IsOptional()
  @IsString()
  @MaxLength(20)
  imei?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tokenPush?: string;

  @IsEnum(Plataforma, {
    message: `plataforma debe ser uno de: ${Object.values(Plataforma).join(', ')}`,
  })
  plataforma: Plataforma;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  versionApp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modeloDispositivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sistemaOperativo?: string;

  // ─── Ubicación ─────────────────────────────────────────────────────────────

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  longitud?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  precisionMetros?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoPostal?: string;

  // ─── Preferencias de notificación ──────────────────────────────────────────

  @IsOptional()
  @IsBoolean()
  notifActivas?: boolean;

  @IsOptional()
  @IsBoolean()
  gpsActivo?: boolean;

  @IsOptional()
  @IsBoolean()
  notifMeteorologicas?: boolean;

  @IsOptional()
  @IsBoolean()
  notifUltimaHora?: boolean;

  @IsOptional()
  @IsBoolean()
  notifVialidad?: boolean;

  @IsOptional()
  @IsBoolean()
  notifServicios?: boolean;

  // ─── Horario silencioso (formato HH:mm o HH:mm:ss) ────────────────────────

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'silencioInicio debe tener formato HH:mm o HH:mm:ss',
  })
  silencioInicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'silencioFin debe tener formato HH:mm o HH:mm:ss',
  })
  silencioFin?: string;

  // ─── Severidad mínima ──────────────────────────────────────────────────────

  @IsOptional()
  @IsEnum(SeveridadMinima, {
    message: `severidadMinima debe ser uno de: ${Object.values(SeveridadMinima).join(', ')}`,
  })
  severidadMinima?: SeveridadMinima;
}
