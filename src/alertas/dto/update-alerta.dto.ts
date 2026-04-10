import { PartialType } from '@nestjs/mapped-types';
import { CreateAlertaDto } from './create-alerta.dto';

/**
 * DTO para actualizar una alerta existente.
 * Todos los campos son opcionales (PATCH semántico).
 */
export class UpdateAlertaDto extends PartialType(CreateAlertaDto) {}
