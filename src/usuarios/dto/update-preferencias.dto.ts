import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenciasDto {
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
}
