import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EstatusAlerta, NivelSeveridad } from './create-alerta.dto';

/**
 * DTO para filtrar alertas en el listado.
 */
export class QueryAlertasDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @IsEnum(EstatusAlerta)
  @IsOptional()
  estatus?: EstatusAlerta;

  @IsEnum(NivelSeveridad)
  @IsOptional()
  nivelSeveridad?: NivelSeveridad;

  @IsInt()
  @IsOptional()
  categoriaId?: number;

  @IsString()
  @IsOptional()
  busqueda?: string;
}
