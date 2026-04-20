import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

/**
 * Validación tipada de variables de entorno usando class-validator.
 *
 * Si alguna variable requerida falta o tiene formato incorrecto,
 * la app no arranca y muestra un error claro.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsNumber()
  @IsOptional()
  JWT_EXPIRES_IN?: number = 86400;

  @IsNumber()
  @IsOptional()
  PORT?: number = 5000;

  @IsString()
  @IsNotEmpty()
  ONESIGNAL_APP_ID!: string;

  @IsString()
  @IsNotEmpty()
  ONESIGNAL_REST_API_KEY!: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`❌ Variables de entorno inválidas:\n  - ${messages}`);
  }

  return validatedConfig;
}
