import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El email o nombre de usuario es requerido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El password es requerido.' })
  @MinLength(6, { message: 'El password debe tener al menos 6 caracteres.' })
  password!: string;
}
