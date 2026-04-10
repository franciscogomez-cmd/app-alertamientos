import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El email es requerido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El password es requerido.' })
  @MinLength(6, { message: 'El password debe tener al menos 6 caracteres.' })
  password!: string;
}
