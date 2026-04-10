import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstatusAlerta } from './create-alerta.dto';

/**
 * DTO para registrar una actualización de estado en una alerta.
 */
export class CreateActualizacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El mensaje de actualización es requerido.' })
  mensaje!: string;

  @IsEnum(EstatusAlerta, { message: 'estatusNuevo inválido.' })
  estatusNuevo!: EstatusAlerta;

  @IsBoolean()
  @IsOptional()
  enviarPush?: boolean;
}
