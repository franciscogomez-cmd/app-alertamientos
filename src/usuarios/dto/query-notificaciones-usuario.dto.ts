import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum EstatusEnvio {
  PENDIENTE = 'pendiente',
  ENVIADA = 'enviada',
  FALLIDA = 'fallida',
  REBOTADA = 'rebotada',
}

/**
 * DTO para consultar notificaciones de un usuario con filtros y paginación.
 */
export class QueryNotificacionesUsuarioDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(EstatusEnvio, {
    message: `estatus debe ser uno de: ${Object.values(EstatusEnvio).join(', ')}`,
  })
  estatus?: EstatusEnvio;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  soloLeidas?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  soloNoLeidas?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  alertaId?: number;
}
